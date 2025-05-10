// public/src/main.js
import { questions } from "./questions.js";
import { db }        from "./firebaseConfig.js";
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import html2canvas from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js";

// —– GLOBE BACKGROUND —–
const canvas = document.getElementById("globe");
const ctx    = canvas.getContext("2d");
let size, center, radius, angle = 0;

function resizeCanvas() {
  size = Math.min(window.innerWidth, window.innerHeight);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  center = { x: canvas.width/2, y: canvas.height/2 };
  radius = Math.min(canvas.width, canvas.height) * 0.6;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawGlobe() {
  angle += 0.002;
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Tierra (círculo azul)
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0,0, radius, 0, 2*Math.PI);
  ctx.fillStyle = "#0077cc";
  ctx.fill();
  ctx.restore();

  // Líneas ficticias de conexión
  const points = [
    { a:0.1, b:1.2 }, { a:2.0, b:3.5 }, { a:4.1, b:5.8 },
    { a:1.5, b:4.8 }, { a:3.2, b:0.5 }
  ];
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(angle);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  points.forEach(p => {
    const x1 = radius * Math.cos(p.a);
    const y1 = radius * Math.sin(p.a);
    const x2 = radius * Math.cos(p.b);
    const y2 = radius * Math.sin(p.b);
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    // curva
    ctx.quadraticCurveTo(0,0, x2,y2);
    ctx.stroke();
  });
  ctx.restore();

  requestAnimationFrame(drawGlobe);
}
drawGlobe();

// —– DOM REFS —–
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
const payBtn          = document.getElementById("pay-btn");

// —– VARIABLES TEST —–
let currentIndex = 0,
    correctCount = 0,
    startTime, elapsedSeconds = 0,
    timerInterval,
    selectedOption = null,
    playerInfo = {};

// —– FAKE PLAYERS —–
const fakePlayers = [
  { name:"Alex",  country:"US", points:95 },
  { name:"Maria", country:"ES", points:92 },
  { name:"Li",    country:"CN", points:90 },
  { name:"Sara",  country:"FR", points:88 },
  { name:"Oliver",country:"GB", points:85 },
  { name:"Fatima",country:"BR", points:83 },
  { name:"Hiro",  country:"JP", points:80 },
  { name:"Elena", country:"RU", points:78 },
  { name:"Carlos",country:"MX", points:76 },
  { name:"Chloe", country:"CA", points:74 },
];

// —– HELPERS —–
function countryToFlag(cc){
  return cc.toUpperCase().split("")
    .map(c=>String.fromCodePoint(0x1F1E6 + c.charCodeAt(0)-65))
    .join("");
}

// —– RANKING —–
function initRanking(){
  const last = JSON.parse(sessionStorage.getItem("lastPlayer")||"null");
  const q = query(collection(db,"players"), orderBy("points","desc"), limit(1000));
  onSnapshot(q, snap => {
    const real = snap.docs.map(d=>d.data());
    const slot = Math.max(0,10 - real.length);
    const list = real
      .concat(fakePlayers.slice(0,slot))
      .sort((a,b)=>b.points - a.points)
      .slice(0,10);

    rankingBody.innerHTML = "";
    list.forEach((p,i)=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i+1}</td>
        <td>${p.name}</td>
        <td>${countryToFlag(p.country)}</td>
        <td>${p.points}</td>
      `;
      rankingBody.appendChild(tr);
    });

    if(last && last.rank>10){
      rankingBody.insertAdjacentHTML("beforeend",
        `<tr><td colspan="4" style="text-align:center">…</td></tr>`
      );
      const p = last;
      rankingBody.insertAdjacentHTML("beforeend",`
        <tr>
          <td>${p.rank}</td>
          <td>${p.name}</td>
          <td>${countryToFlag(p.country)}</td>
          <td>${p.points}</td>
        </tr>
      `);
    }
  });
}

// —– TIMER —–
function startTimer(){
  startTime = Date.now();
  timerInterval = setInterval(()=>{
    elapsedSeconds = Math.floor((Date.now()-startTime)/1000);
    const m = String(Math.floor(elapsedSeconds/60)).padStart(2,"0");
    const s = String(elapsedSeconds%60).padStart(2,"0");
    timerEl.textContent = `Time: ${m}:${s}`;
  }, 500);
}

// —– TEST FLOW —–
function showQuestion(){
  const q = questions[currentIndex];
  questionText.textContent = q.text;
  optionsEl.innerHTML = "";
  q.options.forEach((opt,i)=>{
    const b = document.createElement("button");
    b.textContent = opt;
    b.className = "option";
    b.onclick = ()=>selectOption(i);
    optionsEl.appendChild(b);
  });
  nextBtn.classList.add("hidden");
}

function selectOption(i){
  selectedOption = i;
  Array.from(optionsEl.children).forEach((b,j)=>{
    b.classList.toggle("selected", i===j);
  });
  nextBtn.classList.remove("hidden");
}

nextBtn.onclick = ()=>{
  if(selectedOption === questions[currentIndex].answer) correctCount++;
  currentIndex++;
  selectedOption = null;
  currentIndex < questions.length
    ? showQuestion()
    : finishTest();
};

// —– FINISH & GUARDAR —–
async function finishTest(){
  clearInterval(timerInterval);
  testContainer.classList.add("hidden");
  const points = correctCount*10 - elapsedSeconds;

  await addDoc(collection(db,"players"), {
    ...playerInfo,
    points,
    time: elapsedSeconds,
    createdAt: new Date()
  });

  // calcular rank
  const snap = await getDocs(
    query(collection(db,"players"), orderBy("points","desc"), limit(1000))
  );
  const all = snap.docs.map(d=>d.data());
  const idx = all.findIndex(p=>
    p.name===playerInfo.name &&
    p.country===playerInfo.country &&
    p.points===points
  ) + 1;

  sessionStorage.setItem("lastPlayer", JSON.stringify({
    ...playerInfo, points, rank: idx
  }));

  scoreText.textContent = `Score: ${points} pts (correct: ${correctCount}, time: ${elapsedSeconds}s)`;
  rankText.textContent  = `Your rank: #${idx}`;
  resultContainer.classList.remove("hidden");
}

// —– SHARE & HOME —–
shareBtn.onclick = ()=>{
  html2canvas(resultContainer).then(canvas=>{
    const a = document.createElement("a");
    a.href = canvas.toDataURL();
    a.download = `IQ-${playerInfo.name}-${Date.now()}.png`;
    a.click();
  });
};
homeBtn.onclick = ()=> window.location.href = "/";

// —– FORM & CHECKOUT —–
startForm.addEventListener("submit", async e=>{
  e.preventDefault();
  playerInfo = {
    name:    document.getElementById("name").value.trim(),
    country: document.getElementById("country").value
  };
  sessionStorage.setItem("playerInfo", JSON.stringify(playerInfo));
  const res  = await fetch("/api/create-checkout-session", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(playerInfo)
  });
  const { url } = await res.json();
  window.location.href = url;
});

// —– ON LOAD —–
window.addEventListener("DOMContentLoaded", ()=>{
  initRanking();
  const params = new URLSearchParams(location.search);
  if(params.get("success")==="true"){
    formContainer.classList.add("hidden");
    testContainer.classList.remove("hidden");
    startTimer();
    showQuestion();
    history.replaceState({}, "", "/");
  }
});
