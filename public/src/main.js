
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
  loadRanking();

  const form = document.getElementById("start-form");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const country = document.getElementById("country").value;

      if (!name || !country) {
        return alert("Por favor, completa tu nombre y país");
      }

      // Guardar en localStorage para usar tras el pago
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
          alert("Error: " + (json.error || "desconocido"));
        }
      } catch (err) {
        console.error("Stripe Error:", err);
        alert("Error de conexión con el servidor");
      }
    });
  }

  if (new URLSearchParams(window.location.search).get("success") === "true") {
    startTest();
  }
});

function startTest() {
  const app = document.createElement("div");
  app.className = "space-y-4 mt-8";
  document.querySelector(".max-w-md").innerHTML = ""; // limpia formulario

  let current = 0;
  let score = 0;
  const startTime = Date.now();

  const renderQuestion = () => {
    app.innerHTML = "";
    if (current >= questions.length) {
      const totalTime = Math.round((Date.now() - startTime) / 1000);

      const name = localStorage.getItem("lastName") || "Anónimo";
      const country = localStorage.getItem("lastCountry") || "Desconocido";

      app.innerHTML = `
        <h2 class="text-lg font-bold">Resultado Final</h2>
        <p>Has acertado ${score} de ${questions.length} preguntas.</p>
        <p>Tiempo total: ${totalTime} segundos.</p>
      `;

      addDoc(collection(db, "players"), {
        name,
        country,
        score,
        time: totalTime,
        timestamp: serverTimestamp()
      });

      return;
    }

    const q = questions[current];
    const form = document.createElement("form");
    form.className = "space-y-2";
    form.innerHTML = `
      <h2 class="text-lg font-semibold">${q.text}</h2>
      ${q.options.map((opt, i) => `
        <label class="block">
          <input type="radio" name="answer" value="${i}" class="mr-2" />
          ${opt}
        </label>
      `).join("")}
      <button type="submit" class="mt-4 w-full py-2 bg-blue-600 text-white rounded">Siguiente</button>
    `;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const answer = form.answer.value;
      if (answer === "") return alert("Selecciona una respuesta.");
      if (parseInt(answer) === q.answer) score++;
      current++;
      renderQuestion();
    });

    app.appendChild(form);
  };

  document.querySelector(".max-w-md").appendChild(app);
  renderQuestion();
}

async function loadRanking() {
  const q = query(
    collection(db, "players"),
    orderBy("score", "desc"),
    orderBy("time", "asc"),
    limit(10)
  );
  const snap = await getDocs(q);
  const tbody = document.getElementById("ranking-body");
  if (!tbody) return;
  tbody.innerHTML = "";
  snap.forEach((doc, i) => {
    const { name, country, score, time } = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2 text-center">${i + 1}</td>
      <td class="px-3 py-2">${name}</td>
      <td class="px-3 py-2">${country}</td>
      <td class="px-3 py-2 text-center">${score}</td>
    `;
    tbody.appendChild(tr);
  });
}
