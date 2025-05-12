// public/src/main.js
import { questions } from "./questions.js";
import { db }        from "./firebaseConfig.js";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import html2canvas   from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js";

// DOM refs
const formContainer   = document.getElementById("form-container");
const startForm       = document.getElementById("start-form");
const rankingBody     = document.querySelector("#ranking tbody");
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

// Country autocomplete
const countryInput    = document.getElementById("country");
const countryDatalist = document.getElementById("country-list");
let countryMap = []; // { name, code }

// State
let currentIndex = 0,
    correctCount = 0,
    startTime, elapsedSeconds = 0,
    timerInterval,
    selectedOption = null,
    playerInfo = {};

// 1) Load all countries for autocomplete
async function loadCountries() {
  try {
    const res = await fetch("https://restcountries.com/v3.1/all?fields=name,cca2");
    const data = await res.json();
    countryMap = data
      .map(c => ({ name: c.name.common, code: c.cca2 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    countryMap.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      countryDatalist.appendChild(opt);
    });
  } catch (e) {
    console.error("Could not load country list", e);
  }
}

// 2) Ranking init (exactly as before)
const fakePlayers = [
  { name: "Alex", country: "US", points: 95 },
  { name: "Maria", country: "ES", points: 92 },
  { name: "Li", country: "CN", points: 90 },
  /* …etc… */
];
function countryToFlag(cc) {
  return cc.toUpperCase().split("")
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join("");
}
function initRanking() {
  const lastPlayer = JSON.parse(sessionStorage.getItem("lastPlayer") || "null");
  const q = query(collection(db, "players"), orderBy("points", "desc"), limit(100));
  onSnapshot(q, snap => {
    const real = snap.docs.map(d => d.data());
    const slot = Math.max(0, 10 - real.length);
    const list = real
      .concat(fakePlayers.slice(0, slot))
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

// Timer & quiz flow (unchanged)
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2,"0");
    const s = String(elapsedSeconds % 60).padStart(2,"0");
    timerEl.textContent = `Time: ${m}:${s}`;
  }, 500);
}
function showQuestion() {
  const q = questions[currentIndex];
  questionText.textContent = q.text;
  optionsEl.innerHTML = "";
  q.options.forEach((opt,i) => {
    const btn = document.createElement("button");
    btn.textContent = opt;
    btn.className = "w-full p-2 border rounded hover:bg-gray-100";
    btn.onclick = () => selectOption(i);
    optionsEl.appendChild(btn);
  });
  nextBtn.classList.add("hidden");
}
function selectOption(idx) {
  selectedOption = idx;
  Array.from(optionsEl.children).forEach((b,i) =>
    b.classList.toggle("bg-blue-100", i===idx)
  );
  nextBtn.classList.remove("hidden");
}
nextBtn.onclick = () => {
  if (selectedOption === questions[currentIndex].answer) correctCount++;
  currentIndex++; selectedOption=null;
  currentIndex < questions.length ? showQuestion() : finishTest();
};

async function finishTest() {
  clearInterval(timerInterval);
  testContainer.classList.add("hidden");
  const points = correctCount * 10 - elapsedSeconds;

  // save to Firestore
  try {
    const code = countryMap.find(c=>c.name===playerInfo.country)?.code || playerInfo.country;
    await addDoc(collection(db,"players"), {
      ...playerInfo,
      country: code,
      points,
      time: elapsedSeconds,
      createdAt: new Date()
    });
  } catch(e) {
    console.error("FIRESTORE ERROR:", e);
  }

  // compute your rank
  const qSnap = await getDocs(
    query(collection(db,"players"), orderBy("points","desc"), limit(1000))
  );
  const list = qSnap.docs.map(d=>d.data());
  const idx = list.findIndex(p=>
    p.name===playerInfo.name &&
    p.country===playerInfo.country &&
    p.points===points
  ) + 1;
  sessionStorage.setItem("lastPlayer", JSON.stringify({
    name: playerInfo.name,
    country: playerInfo.country,
    points,
    rank: idx
  }));
  showResult(points, idx);
}

function showResult(points, rank) {
  scoreText.textContent = `Score: ${points} pts (correct: ${correctCount}, time: ${elapsedSeconds}s)`;
  rankText.textContent  = `Your rank: #${rank}`;
  resultContainer.classList.remove("hidden");
}
shareBtn.onclick = () => {
  html2canvas(resultContainer).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `IQ-${playerInfo.name}-${Date.now()}.png`;
    link.click();
  });
};
homeBtn.onclick = () => window.location.href = window.location.origin;

startForm.addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("name").value;
  const country = document.getElementById("country").value;

const res = await fetch("/api/create-checkout-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, country }),
});


  const json = await res.json();
  if (json.url) {
    window.location.href = json.url;
  } else {
    alert("Error: " + json.error);
  }
});


window.addEventListener("DOMContentLoaded", () => {
  // build up
  loadCountries();
  initRanking();

  const params = new URLSearchParams(window.location.search);
  if (params.get("success")==="true") {
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
