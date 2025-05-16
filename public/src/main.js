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

  const renderQuestion = async () => {
    if (current >= questions.length) {
      clearInterval(timerInterval);
      const totalTime = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(totalTime / 60);
      const seconds = totalTime % 60;

      // Save score to Firebase
      const playerData = {
        name: localStorage.getItem("lastName"),
        country: localStorage.getItem("lastCountry"),
        score: score,
        time: totalTime,
        timestamp: serverTimestamp()
      };

      try {
        // Change collection name from "players" to "ranking"
        await addDoc(collection(db, "ranking"), playerData);
        console.log("Score saved successfully");
      } catch (error) {
        console.error("Error saving score:", error);
      }

      const resultDiv = document.createElement("div");
      resultDiv.className = "text-center p-6 bg-gray-50 rounded-lg";
      resultDiv.innerHTML = `
        <h2 class="text-2xl font-bold mb-4">Test Completed!</h2>
        <p class="text-lg mb-2">You got ${score} out of ${questions.length} questions correct.</p>
        <p class="text-md text-gray-600">Total time: ${minutes}m ${seconds}s</p>
        <button id="homeBtn" class="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Back to Home
        </button>
      `;

      resultDiv.querySelector("#homeBtn").addEventListener("click", () => {
        window.location.href = "/";
      });

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
  try {
    console.log("Loading ranking...");
    
    // Query real players
    const q = query(
      collection(db, "ranking"),
      orderBy("score", "desc"),
      orderBy("time", "asc"),
      limit(50)
    );
    
    const querySnapshot = await getDocs(q);
    const tbody = document.getElementById("ranking-body");
    if (!tbody) return;

    tbody.innerHTML = "";
    
    // Convert snapshot to array
    const players = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Bots with decreasing scores and increasing times
    const simulatedUsers = [
      { name: "Alexander Thompson", country: "United Kingdom", score: 48, time: 1832 },
      { name: "Wei Chen", country: "China", score: 47, time: 1923 },
      { name: "Isabella Santos", country: "Brazil", score: 46, time: 2154 },
      { name: "Markus Weber", country: "Germany", score: 45, time: 2012 },
      { name: "Sophie Dubois", country: "France", score: 44, time: 2245 },
      { name: "Hiroshi Tanaka", country: "Japan", score: 43, time: 1978 },
      { name: "Priya Patel", country: "India", score: 42, time: 2167 },
      { name: "Carmen García", country: "Spain", score: 41, time: 2089 },
      { name: "James Miller", country: "USA", score: 40, time: 2198 },
      { name: "Min-ji Kim", country: "South Korea", score: 39, time: 2321 },
      { name: "Lucas Silva", country: "Portugal", score: 38, time: 2156 },
      { name: "Emma Andersson", country: "Sweden", score: 37, time: 2289 },
      { name: "Marco Rossi", country: "Italy", score: 36, time: 2432 },
      { name: "Anna Kowalski", country: "Poland", score: 35, time: 2345 },
      { name: "Yuki Sato", country: "Japan", score: 34, time: 2167 }
    ];

    // Combine real players with bots if needed
    let displayRows = [...players];
    if (displayRows.length < 10) {
      const botsNeeded = 10 - displayRows.length;
      displayRows = [...displayRows, ...simulatedUsers.slice(0, botsNeeded)];
    }

    // Sort combined array by score (desc) and time (asc)
    displayRows.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.time - b.time;
    });

    // Format time function (converts seconds to HH:MM:SS)
    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Show top 10
    displayRows.slice(0, 10).forEach((player, index) => {
      const tr = document.createElement("tr");
      tr.className = "hover:bg-gray-50";
      
      // Highlight if it's the current user
      const isCurrentUser = player.name === localStorage.getItem("lastName") &&
                          player.country === localStorage.getItem("lastCountry");
      
      if (isCurrentUser) {
        tr.className += " bg-yellow-50 font-semibold";
      }

      // Add bot indicator for bot players
      const isBot = player.name.startsWith("Bot");
      const name = isBot ? `🤖 ${player.name}` : player.name;

      tr.innerHTML = `
        <td class="px-3 py-2 text-center">${index + 1}</td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <span>${name}</span>
          </div>
        </td>
        <td class="px-3 py-2">${player.country}</td>
        <td class="px-3 py-2 text-center">${player.score}</td>
        <td class="px-3 py-2 text-center text-gray-600">${formatTime(player.time)}</td>
      `;
      tbody.appendChild(tr);
    });

    // Show current user's position if not in top 10
    const currentName = localStorage.getItem("lastName");
    const currentCountry = localStorage.getItem("lastCountry");
    const userPosition = displayRows.findIndex(p => 
      p.name === currentName && p.country === currentCountry
    );

    if (userPosition >= 10) {
      const separator = document.createElement("tr");
      separator.innerHTML = `
        <td colspan="5" class="text-center py-2 text-gray-400 border-t border-b">
          • • •
        </td>
      `;
      tbody.appendChild(separator);

      const userRow = document.createElement("tr");
      userRow.className = "bg-yellow-50 font-semibold";
      userRow.innerHTML = `
        <td class="px-3 py-2 text-center">${userPosition + 1}</td>
        <td class="px-3 py-2">
          <div class="flex items-center gap-2">
            <span>${currentName}</span>
          </div>
        </td>
        <td class="px-3 py-2">${currentCountry}</td>
        <td class="px-3 py-2 text-center">${displayRows[userPosition].score}</td>
        <td class="px-3 py-2 text-center text-gray-600">${formatTime(displayRows[userPosition].time)}</td>
      `;
      tbody.appendChild(userRow);
    }

  } catch (error) {
    console.error("Error loading ranking:", error);
    const tbody = document.getElementById("ranking-body");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="px-3 py-2 text-center text-red-500">
            Error loading rankings. Please try again later.
          </td>
        </tr>
      `;
    }
  }
}
