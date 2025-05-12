// main.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Tu configuración de Firebase (sin exponerla aquí; se inyecta con .env en la build)
import { firebaseConfig } from "./firebaseConfig.js";

// Inicializamos Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Inicializamos Stripe (la clave pública debe estar en ENV de Vercel)
// Recuerda añadir STRIPE_PUBLISHABLE_KEY como variable de entorno
const stripe = Stripe(process.env.STRIPE_PUBLISHABLE_KEY);

window.addEventListener("DOMContentLoaded", () => {
  buildCountryAutocomplete();
  loadRanking();

  document
    .getElementById("start-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const country = document.getElementById("country").value.trim();
      if (!name || !country) {
        return alert("Please fill in both fields");
      }

      // Llamada a tu función serverless
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, country }),
      });
      const json = await res.json();
      if (json.url) {
        window.location = json.url;
      } else {
        alert("Error: " + (json.error || "unknown"));
      }
    });
});

async function loadRanking() {
  const q = query(
    collection(db, "players"),
    orderBy("score", "desc"),
    limit(10)
  );
  const snap = await getDocs(q);
  const tbody = document.getElementById("ranking-body");
  snap.forEach((doc, i) => {
    const { name, country, score } = doc.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2">${i + 1}</td>
      <td class="px-3 py-2">${name}</td>
      <td class="px-3 py-2">${country}</td>
      <td class="px-3 py-2">${score}</td>
    `;
    tbody.appendChild(tr);
  });
}

function buildCountryAutocomplete() {
  // Aquí puedes pegar la lista de todos los países en inglés
  const countries = [
    "Afghanistan", "Albania", "Algeria", /* ... etc ... */ "Zimbabwe"
  ];
  const dl = document.getElementById("countries");
  countries.forEach((c) => {
    const o = document.createElement("option");
    o.value = c;
    dl.appendChild(o);
  });
}
