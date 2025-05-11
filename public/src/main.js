// public/src/main.js

import { questions } from "./questions.js";
import { db }        from "./firebaseConfig.js";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import html2canvas from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js";

// ── DOM REFERENCES ──────────────────────────────────────────────────────────────
const formContainer   = document.getElementById("form-container");
const startForm       = document.getElementById("start-form");
const rankingBody     = document.getElementById("ranking-body");
const testContainer   = document.getElementById("test-container");
const resultContainer = document.getElementById("result-container");
const timerEl         = document.getElementById("timer");
const questionText    = document.getElementById("question-text");
const optionsEl       = document.getElementById("options");
const nextBtn         = document.getElementById("next-btn");
const scoreText       = document.getElementById("score-text");
const rankText        = document.getElementById("rank-text");
const shareBtn        = document.getElementById("share-btn");
const homeBtn         = document.getElementById("home-btn");
const countryInput    = document.getElementById("country");

// ── STATE ───────────────────────────────────────────────────────────────────────
let currentIndex   = 0;
let correctCount   = 0;
let startTime      = 0;
let elapsedSeconds = 0;
let timerInterval  = null;
let selectedOption = null;
let playerInfo     = {};
const countryMap   = {}; // name → ISO code

// ── FAKE PLAYERS FOR TOP-10 FILL ────────────────────────────────────────────────
const fakePlayers = [
  { name: "Alex",   country: "US", points: 95 },
  { name: "Maria",  country: "ES", points: 92 },
  { name: "Li",     country: "CN", points: 90 },
  { name: "Sara",   country: "FR", points: 88 },
  { name: "Oliver", country: "GB", points: 85 },
  { name: "Fatima", country: "BR", points: 83 },
  { name: "Hiro",   country: "JP", points: 80 },
  { name: "Elena",  country: "RU", points: 78 },
  { name: "Carlos", country: "MX", points: 76 },
  { name: "Chloe",  country: "CA", points: 74 }
];

// ── HELPERS ─────────────────────────────────────────────────────────────────────

// Convert country ISO code to flag emoji
function countryToFlag(cc) {
  return cc.toUpperCase()
    .split("")
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join("");
}

// Populate country datalist by fetching from REST Countries API
async function loadCountries() {
  try {
    const res  = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
    const data = await res.json();
    const list = document.getElementById("country-list");
    data
      .map(c => ({ name: c.name.common, code: c.cca2 }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(({ name, code }) => {
        countryMap[name] = code;
        const opt = document.createElement("option");
        opt.value = name;
        list.appendChild(opt);
      });
  } catch (e) {
    console.error("Failed loading countries:", e);
  }
}

// ── RANKING ────────────────────────────────────────────────────────────────────

// Initialize live ranking from Firestore (plus fake fill)
function initRanking() {
  const lastPlayer = JSON.parse(sessionStorage.getItem("lastPlayer") || "null");
  const q = query(
    collection(db, "players"),
    orderBy("points", "desc"),
    limit(100)
  );
  onSnapshot(q, snap => {
    const real = snap.docs.map(d => d.data());
    const need = Math.max(0, 10 - real.length);
    const list = real
      .concat(fakePlayers.slice(0, need))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    rankingBody.innerHTML = "";
    list.forEach((p, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-2 py-1">${i+1}</td>
        <td class="px-2 py-1">${p.name}</td>
        <td class="px-2 py-1">${countryToFlag(p.country)}</td>
        <td class="px-2 py-1">${p.points}</td>
      `;
      rankingBody.appendChild(tr);
    });

    if (lastPlayer && lastPlayer.rank > 10) {
      const sep = document.createElement("tr");
      sep.innerHTML = `<td colspan="4" class="text-center">…</td>`;
      rankingBody.appendChild(sep);
      const p = lastPlayer;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="px-2 py-1">${p.rank}</td>
        <td class="px-2 py-1">${p.name}</td>
        <td class="px-2 py-1">${countryToFlag(p.country)}</td>
        <td class="px-2 py-1">${p.points}</td>
      `;
      rankingBody.appendChild(tr);
    }
  });
}

// ── TIMER & QUESTIONS ──────────────────────────────────────────────────────────

// Start the countdown timer
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const s = String(elapsedSeconds % 60).padStart(2, "0");
    timerEl.textContent = `Time: ${m}:${s}`;
  }, 500);
}

// Show the current question and its options
function showQuestion() {
  const q = questions[currentIndex];
  questionText.textContent = q.text;
  optionsEl.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "w-full p-2 border rounded hover:bg-gray-100";
    btn.onclick = () => selectOption(i);
    optionsEl.appendChild(btn);
  });
  nextBtn.classList.add("hidden");
}

// Highlight selected option
function selectOption(idx) {
  selectedOption = idx;
  Array.from(optionsEl.children).forEach((b, i) =>
    b.classList.toggle("bg-blue-100", i === idx)
  );
  nextBtn.classList.remove("hidden");
}

// Advance to next question or finish
nextBtn.onclick = () => {
  if (selectedOption === questions[currentIndex].answer) correctCount++;
  currentIndex++;
  selectedOption = null;
  if (currentIndex < questions.length) {
    showQuestion();
  } else {
    finishTest();
  }
};

// ── FINISH & FIRESTORE ──────────────────────────────────────────────────────────

async function finishTest() {
  clearInterval(timerInterval);
  testContainer.classList.add("hidden");
  const points = correctCount * 10 - elapsedSeconds;

  // Save to Firestore
  try {
    await addDoc(collection(db, "players"), {
      ...playerInfo,
      points,
      time: elapsedSeconds,
      createdAt: new Date()
    });
  } catch (e) {
    console.error("Firestore Error:", e);
  }

  // Compute rank
  const snap = await getDocs(
    query(collection(db, "players"), orderBy("points", "desc"), limit(1000))
  );
  const list = snap.docs.map(d => d.data());
  const idx = list.findIndex(p =>
    p.name === playerInfo.name &&
    p.country === playerInfo.country &&
    p.points === points
  ) + 1;

  sessionStorage.setItem("lastPlayer", JSON.stringify({
    name: playerInfo.name,
    country: playerInfo.country,
    points,
    rank: idx
  }));

  showResult(points, idx);
}

// Display result screen
function showResult(points, rank) {
  scoreText.textContent = `Score: ${points} pts (correct: ${correctCount}, time: ${elapsedSeconds}s)`;
  rankText.textContent = `Your rank: #${rank}`;
  resultContainer.classList.remove("hidden");
}

// Share via image
shareBtn.onclick = () => {
  html2canvas(resultContainer).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `IQ-${playerInfo.name}-${Date.now()}.png`;
    link.click();
  });
};

// Return home
homeBtn.onclick = () => {
  window.location.href = window.location.origin;
};

// ── FORM SUBMISSION & CHECKOUT ─────────────────────────────────────────────────

startForm.addEventListener("submit", async e => {
  e.preventDefault();
  const rawCountry = countryInput.value.trim();
  const code = countryMap[rawCountry];
  if (!code) {
    alert("Please select a valid country from the list.");
    return;
  }
  playerInfo = {
    name:    document.getElementById("name").value.trim(),
    country: code
  };
  sessionStorage.setItem("playerInfo", JSON.stringify(playerInfo));

  // Create Stripe checkout session via your /api endpoint
  const res  = await fetch(`${window.location.origin}/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(playerInfo)
  });
  const { url } = await res.json();

  // Redirect out of iframe
  if (window.top === window.self) {
    window.location.href = url;
  } else {
    window.top.location.href = url;
  }
});

// ── ON LOAD ─────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  loadCountries();
  initRanking();

  const params = new URLSearchParams(window.location.search);
  if (params.get("success") === "true") {
    const d = sessionStorage.getItem("playerInfo");
    if (d) {
      playerInfo = JSON.parse(d);
      formContainer.classList.add("hidden");
      testContainer.classList.remove("hidden");
      startTimer();
      showQuestion();
      sessionStorage.removeItem("playerInfo");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }
});
