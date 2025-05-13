
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const stripe = Stripe("pk_test_51QHTsa2NDihRJw0kAXtWxnMrgannm7KXUSglH7tzJkzAYChugXSnWM7G9Iq0InGHrGPbSDcTTDHrJPtGNKDj2B8r00NziIrYKM");

window.addEventListener("DOMContentLoaded", () => {
  loadRanking();

  document
    .getElementById("start-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name").value.trim();
      const country = document.getElementById("country").value;

      if (!name || !country) {
        return alert("Por favor, completa tu nombre y país");
      }

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
          console.error("Stripe error:", json);
          alert("Error al iniciar el pago: " + (json.error || "desconocido"));
        }
      } catch (err) {
        console.error("Fetch error:", err);
        alert("Error al conectar con el servidor.");
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
  tbody.innerHTML = "";
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
