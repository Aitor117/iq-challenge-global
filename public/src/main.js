import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { firebaseConfig } from "./firebaseConfig.js";
import { questions } from "./questions.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const stripe = Stripe("pk_test_51QHTsa2NDihRJw0kAXtWxnMrgannm7KXUSglH7tzJkzAYChugXSnWM7G9Iq0InGHrGPbSDcTTDHrJPtGNKDj2B8r00NziIrYKM");

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("start-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const country = document.getElementById("country").value;

      if (!name || !country) return alert("Please complete all fields");

      localStorage.setItem("lastName", name);
      localStorage.setItem("lastCountry", country);

      try {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, country }),
        });

        const json = await res.json();
        if (json.url) {
          window.location.href = json.url;
        } else {
          alert("Stripe error: " + (json.error || "unknown"));
        }
      } catch (err) {
        console.error("Stripe Error:", err);
        alert("Connection error.");
      }
    });
  }

  const isReturningFromStripe = new URLSearchParams(window.location.search).get("success") === "true";
  if (isReturningFromStripe) {
    startTest();
  } else {
    loadRanking();
  }
});

function startTest() {
  const container = document.querySelector(".max-w-md");
  container.innerHTML = "";
  const app = document.createElement("div");
  app.className = "space-y-4 mt-8";

  // Add progress and timer display
  const statusBar = document.createElement("div");
  statusBar.className = "flex justify-between items-center mb-4 text-gray-600";
  statusBar.innerHTML = `
    <div class="progress">Question: <span id="currentQuestion">1</span>/${questions.length}</div>
    <div class="timer">Time: <span id="timer">00:00</span></div>
  `;
  container.appendChild(statusBar);

  let current = 0;
  let score = 0;
  const startTime = Date.now();

  // Timer function
  const updateTimer = () => {
    const timeElapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(timeElapsed / 60);
    const seconds = timeElapsed % 60;
    document.getElementById('timer').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const timerInterval = setInterval(updateTimer, 1000);

  const renderQuestion = () => {
    if (current >= questions.length) {
      clearInterval(timerInterval);
      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(totalTime / 60);
      const seconds = totalTime % 60;

      const resultDiv = document.createElement("div");
      resultDiv.className = "text-center p-6 bg-gray-50 rounded-lg";
      resultDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Test Completed!</h2>
        <p class="text-lg mb-2">You got ${score} out of ${questions.length} questions correct.</p>
        <p class="text-md text-gray-600">Total time: ${minutes}m ${seconds}s</p>
        <button id="restartBtn" class="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Try Again
        </button>
      `;
      app.innerHTML = '';
      app.appendChild(resultDiv);
      return;
    }

    const q = questions[current];
    document.getElementById('currentQuestion').textContent = current + 1;
    
    const form = document.createElement("form");
    form.className = "space-y-4";
    form.innerHTML = `
      <h2 class="text-lg font-semibold mb-4">
        Question ${current + 1} of ${questions.length}
        <hr class="mt-2 border-gray-200">
      </h2>
      <p class="mb-4">${q.text}</p>
      ${q.options.map((opt, i) => `
        <label class="block p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <input type="radio" name="answer" value="${i}" class="mr-2" />
          ${opt}
        </label>
      `).join("")}
      <button type="submit" class="mt-6 w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        ${current === questions.length - 1 ? 'Finish' : 'Next'}
      </button>
    `;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const answer = form.answer.value;
      if (answer === "") return alert("Select an answer.");
      if (parseInt(answer) === q.answer) score++;
      current++;
      renderQuestion();
    });

    app.innerHTML = '';
    app.appendChild(form);
    container.appendChild(app);
  };

  renderQuestion();
}

async function loadRanking() {
  const q = query(
    collection(db, "players"),
    orderBy("score", "desc"),
    orderBy("time", "asc")
  );
  const snap = await getDocs(q);
  const tbody = document.getElementById("ranking-body");
  if (!tbody) return;

  tbody.innerHTML = "";
  const players = snap.docs.map(doc => doc.data());

  const fallbackBots = [
    { name: "Dr. Elias", country: "Germany", score: 49, time: 60 },
    { name: "Prof. Claire", country: "France", score: 47, time: 60 },
    { name: "Isaac K.", country: "USA", score: 45, time: 60 },
    { name: "Yuki Sato", country: "Japan", score: 44, time: 60 },
    { name: "Ahmed Z.", country: "Egypt", score: 43, time: 60 },
    { name: "Lucia V.", country: "Spain", score: 42, time: 60 },
    { name: "Ravi P.", country: "India", score: 41, time: 60 },
    { name: "Sophie M.", country: "Canada", score: 40, time: 60 },
    { name: "Lea H.", country: "Austria", score: 39, time: 60 },
    { name: "Carlos B.", country: "Mexico", score: 38, time: 60 }
  ];

  const top10 = [...players.slice(0, 10)];
  if (top10.length < 10) {
    const missing = 10 - top10.length;
    top10.push(...fallbackBots.slice(0, missing));
  }

  top10.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2 text-center">${i + 1}</td>
      <td class="px-3 py-2">${p.name}</td>
      <td class="px-3 py-2">${p.country}</td>
      <td class="px-3 py-2 text-center">${p.score}</td>
    `;
    tbody.appendChild(tr);
  });

  const currentName = localStorage.getItem("lastName");
  const currentCountry = localStorage.getItem("lastCountry");
  const currentPlayerIndex = players.findIndex(
    p => p.name === currentName && p.country === currentCountry
  );

  if (currentPlayerIndex >= 10) {
    const user = players[currentPlayerIndex];
    const separator = document.createElement("tr");
    separator.innerHTML = `<td colspan="4" class="text-center py-2 text-gray-400 border-t">...</td>`;
    tbody.appendChild(separator);

    const tr = document.createElement("tr");
    tr.className = "bg-yellow-50 font-semibold";
    tr.innerHTML = `
      <td class="px-3 py-2 text-center">${currentPlayerIndex + 1}</td>
      <td class="px-3 py-2">${user.name}</td>
      <td class="px-3 py-2">${user.country}</td>
      <td class="px-3 py-2 text-center">${user.score}</td>
    `;
    tbody.appendChild(tr);
  }
}
