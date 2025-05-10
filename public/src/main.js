// public/src/main.js

// ———————————————————————————————————————————————
// 1) GLOBE DE FONDO
// ———————————————————————————————————————————————
import Globe from 'https://unpkg.com/globe.gl';

// Define aquí tus “conexiones” de ejemplo (lat/lng)  
const flightPaths = [
  { startLat: 40.4168, startLng: -3.7038, endLat: 51.5074, endLng: -0.1278 }, // Madrid→Londres
  { startLat: 35.6895, startLng: 139.6917, endLat: 40.4168, endLng: -3.7038 },// Tokio→Madrid
  // … añade más conexiones si quieres …
];

// Crea el canvas en el div#globe
const globeEl = document.getElementById('globe');
const world = Globe()(globeEl)
  .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
  .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
  .showAtmosphere(true)
  .backgroundColor('rgba(0,0,0,0)')
  .lineData(flightPaths)
  .lineColor(() => 'cyan')
  .lineWidth(0.7)
  .lineCurveResolution(20)
  .lineAltitude(0.01);

// Auto-rotación lenta
world.controls().autoRotate = true;
world.controls().autoRotateSpeed = 0.2;
world.controls().enableZoom = false;



// ———————————————————————————————————————————————
// 2) RESTO DE TU LÓGICA (Preguntas, Firebase, Stripe…)
// ———————————————————————————————————————————————
import { questions } from './questions.js';
import { db }        from './firebaseConfig.js';
import {
  collection, addDoc, query, orderBy, limit, onSnapshot, getDocs
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import html2canvas   from 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.esm.js';

// referencias DOM
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

let currentIndex = 0,
    correctCount = 0,
    startTime, elapsedSeconds = 0,
    timerInterval,
    selectedOption = null,
    playerInfo = {};

// jugadores fake para rellenar el top10
const fakePlayers = [
  { name:"Alex",   country:"US", points:95 },
  { name:"Maria",  country:"ES", points:92 },
  { name:"Li",     country:"CN", points:90 },
  { name:"Sara",   country:"FR", points:88 },
  { name:"Oliver", country:"GB", points:85 },
  { name:"Fatima", country:"BR", points:83 },
  { name:"Hiro",   country:"JP", points:80 },
  { name:"Elena",  country:"RU", points:78 },
  { name:"Carlos", country:"MX", points:76 },
  { name:"Chloe",  country:"CA", points:74 },
];

// helper ISO → emoji
function countryToFlag(cc){
  return cc.toUpperCase()
    .split("")
    .map(c=>String.fromCodePoint(0x1F1E6 + c.charCodeAt(0)-65))
    .join("");
}

// Inicializa ranking top10 + tu puesto
function initRanking(){
  const lastPlayer = JSON.parse(sessionStorage.getItem("lastPlayer")||"null");
  const q = query(
    collection(db,"players"),
    orderBy("points","desc"),
    limit(100)
  );
  onSnapshot(q, snap=>{
    const real = snap.docs.map(d=>d.data());
    const slot = Math.max(0,10-real.length);
    const list = real
      .concat(fakePlayers.slice(0,slot))
      .sort((a,b)=>b.points-a.points)
      .slice(0,10);

    rankingBody.innerHTML="";
    list.forEach((p,i)=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${i+1}</td>
        <td>${p.name}</td>
        <td>${countryToFlag(p.country)}</td>
        <td>${p.points}</td>
      `;
      rankingBody.appendChild(tr);
    });

    if(lastPlayer && lastPlayer.rank>10){
      const sep=document.createElement("tr");
      sep.innerHTML=`<td colspan="4" class="text-center">…</td>`;
      rankingBody.appendChild(sep);
      const p=lastPlayer, tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${p.rank}</td>
        <td>${p.name}</td>
        <td>${countryToFlag(p.country)}</td>
        <td>${p.points}</td>
      `;
      rankingBody.appendChild(tr);
    }
  });
}

// temporizador
function startTimer(){
  startTime=Date.now();
  timerInterval=setInterval(()=>{
    elapsedSeconds=Math.floor((Date.now()-startTime)/1000);
    const m=String(Math.floor(elapsedSeconds/60)).padStart(2,"0");
    const s=String(elapsedSeconds%60).padStart(2,"0");
    timerEl.textContent=`Time: ${m}:${s}`;
  },500);
}

// mostrar pregunta
function showQuestion(){
  const q=questions[currentIndex];
  questionText.textContent=q.text;
  optionsEl.innerHTML="";
  q.options.forEach((opt,i)=>{
    const btn=document.createElement("button");
    btn.textContent=opt;
    btn.className="w-full p-2 border rounded hover:bg-gray-100";
    btn.onclick=()=>selectOption(i);
    optionsEl.appendChild(btn);
  });
  nextBtn.classList.add("hidden");
}

// seleccionar opción
function selectOption(idx){
  selectedOption=idx;
  Array.from(optionsEl.children).forEach((b,i)=>
    b.classList.toggle("bg-blue-100",i===idx)
  );
  nextBtn.classList.remove("hidden");
}

// siguiente pregunta
nextBtn.onclick=()=>{
  if(selectedOption===questions[currentIndex].answer) correctCount++;
  currentIndex++; selectedOption=null;
  currentIndex<questions.length
    ? showQuestion()
    : finishTest();
};

// terminar test
async function finishTest(){
  clearInterval(timerInterval);
  testContainer.classList.add("hidden");
  const points = correctCount*10 - elapsedSeconds;

  try{
    await addDoc(collection(db,"players"), {
      ...playerInfo,
      points,
      time: elapsedSeconds,
      createdAt: new Date()
    });
  }catch(e){ console.error("FIRESTORE ERROR:",e); }

  const qSnap = await getDocs(
    query(collection(db,"players"), orderBy("points","desc"), limit(1000))
  );
  const list = qSnap.docs.map(d=>d.data());
  const idx = list.findIndex(p=>
    p.name===playerInfo.name &&
    p.country===playerInfo.country &&
    p.points===points
  )+1;

  sessionStorage.setItem("lastPlayer", JSON.stringify({
    name:playerInfo.name,
    country:playerInfo.country,
    points,
    rank:idx
  }));

  showResult(points, idx);
}

// mostrar resultado
function showResult(points, rank){
  scoreText.textContent=`Score: ${points} pts (correct: ${correctCount}, time: ${elapsedSeconds}s)`;
  rankText.textContent=`Your rank: #${rank}`;
  resultContainer.classList.remove("hidden");
}

// compartir imagen
shareBtn.onclick=()=>{
  html2canvas(resultContainer).then(canvas=>{
    const link=document.createElement("a");
    link.href=canvas.toDataURL("image/png");
    link.download=`IQ-${playerInfo.name}-${Date.now()}.png`;
    link.click();
  });
};

// volver al home
homeBtn.onclick=()=>{
  window.location.href=window.location.origin;
};

// formulario → Stripe Checkout
startForm.addEventListener("submit", async e=>{
  e.preventDefault();
  playerInfo = {
    name:    document.getElementById("name").value.trim(),
    country: document.getElementById("country").value
  };
  sessionStorage.setItem("playerInfo", JSON.stringify(playerInfo));
  const res = await fetch(`${window.location.origin}/api/create-checkout-session`, {
    method:"POST", headers:{"Content-Type":"application/json"}
  });
  const { url } = await res.json();
  if(window.top===window.self) window.location.href=url;
  else window.top.location.href=url;
});

// al cargar página
window.addEventListener("DOMContentLoaded", ()=>{
  initRanking();
  const params = new URLSearchParams(window.location.search);
  if(params.get("success")==="true"){
    const d=sessionStorage.getItem("playerInfo");
    if(d){
      playerInfo=JSON.parse(d);
      formContainer.classList.add("hidden");
      testContainer.classList.remove("hidden");
      startTimer();
      showQuestion();
      sessionStorage.removeItem("playerInfo");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }
});
