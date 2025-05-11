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

// ——— FONDO: GLOBO GIRATORIO ———
const canvas = document.getElementById("globe");
const ctx    = canvas.getContext("2d");
let center, radius, angle = 0;

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  center = { x: canvas.width / 2, y: canvas.height / 2 };
  radius = Math.min(canvas.width, canvas.height) * 0.4;
}
window.addEventListener("resize", resize);
resize();

function drawGlobe() {
  angle += 0.002;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Planeta
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#0077cc";
  ctx.fill();
  ctx.restore();

  // Vínculos animados
  const links = [
    { a: 0.3, b: 2.8 },
    { a: 1.1, b: 4.2 },
    { a: 3.7, b: 5.0 },
    { a: 2.0, b: 0.7 },
    { a: 4.5, b: 1.7 }
  ];
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  links.forEach(p => {
    const x1 = radius * Math.cos(p.a);
    const y1 = radius * Math.sin(p.a);
    const x2 = radius * Math.cos(p.b);
    const y2 = radius * Math.sin(p.b);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(0, 0, x2, y2);
    ctx.stroke();
  });
  ctx.restore();

  requestAnimationFrame(drawGlobe);
}
drawGlobe();

// ——— DOM REFS ———
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

// ——— ESTADO ———
let currentIndex   = 0;
let correctCount   = 0;
let startTime;
let elapsedSeconds = 0;
let timerInterval;
let selectedOption = null;
let playerInfo     = {};

// ——— JUGADORES FALSOS ———
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
  { name: "Chloe",  country: "CA", points: 74 },
];

// ——— HELPERS ———
function countryToFlag(cc) {
  return cc.toUpperCase()
    .split("")
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join("");
}

// ——— RANKING EN TIEMPO REAL ———
function initRanking() {
  const last = JSON.parse(sessionStorage.getItem("lastPlayer") || "null");
  const q = query(
    collection(db, "players"),
    orderBy("points", "desc"),
    limit(100)
  );
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

    if (last && last.rank > 10) {
      const sep = document.createElement("tr");
      sep.innerHTML = `<td colspan="4" class="text-center">…</td>`;
      rankingBody.appendChild(sep);

      const p = last;
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

// ——— TIMER ———
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsedSeconds / 60)).padStart(2, "0");
    const s = String(elapsedSeconds % 60).padStart(2, "0");
    timerEl.textContent = `Time: ${m}:${s}`;
  }, 500);
}

// ——— PREGUNTAS ———
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

function selectOption(idx) {
  selectedOption = idx;
  Array.from(optionsEl.children).forEach((b, i) =>
    b.classList.toggle("bg-blue-100", i === idx)
  );
  nextBtn.classList.remove("hidden");
}

nextBtn.onclick = () => {
  if (selectedOption === questions[currentIndex].answer) correctCount++;
  currentIndex++;
  selectedOption = null;
  if (currentIndex < questions.length) showQuestion();
  else finishTest();
};

// ——— FINAL DEL TEST ———
async function finishTest() {
  clearInterval(timerInterval);
  testContainer.classList.add("hidden");
  const points = correctCount * 10 - elapsedSeconds;

  try {
    await addDoc(collection(db, "players"), {
      ...playerInfo,
      points,
      time: elapsedSeconds,
      createdAt: new Date()
    });
  } catch (e) {
    console.error("FIRESTORE ERROR:", e);
  }

  const snap = await getDocs(
    query(collection(db, "players"), orderBy("points", "desc"), limit(1000))
  );
  const list = snap.docs.map(d => d.data());
  const idx  = list.findIndex(p =>
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

function showResult(points, rank) {
  scoreText.textContent = `Score: ${points} pts (correct: ${correctCount}, time: ${elapsedSeconds}s)`;
  rankText.textContent  = `Your rank: #${rank}`;
  resultContainer.classList.remove("hidden");
}

// ——— COMPARTIR ———
shareBtn.onclick = () => {
  html2canvas(resultContainer).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `IQ-${playerInfo.name}-${Date.now()}.png`;
    link.click();
  });
};

// ——— HOME ———
homeBtn.onclick = () => window.location.href = window.location.origin;

// ——— CHECKOUT ———
startForm.addEventListener("submit", async e => {
  e.preventDefault();
  playerInfo = {
    name:    document.getElementById("name").value.trim(),
    country: document.getElementById("country").value
  };
  sessionStorage.setItem("playerInfo", JSON.stringify(playerInfo));

  const res  = await fetch(`/api/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  const json = await res.json();
  if (window.top === window.self) window.location.href = json.url;
  else window.top.location.href = json.url;
});

// ——— INICIALIZACIÓN ———
window.addEventListener("DOMContentLoaded", () => {
  initRanking();
  const params = new URLSearchParams(window.location.search);
  if (params.get("success") === "true") {
    const data = sessionStorage.getItem("playerInfo");
    if (data) {
      playerInfo = JSON.parse(data);
      formContainer.classList.add("hidden");
      testContainer.classList.remove("hidden");
      startTimer();
      showQuestion();
      sessionStorage.removeItem("playerInfo");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }
});
