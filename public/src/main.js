import { initializeApp }         from "firebase/app";
import { getFirestore, collection, query, orderBy, getDocs } from "firebase/firestore";
import countriesList            from "countries-list"; // npm install countries-list

// Stripe (solo cliente)
import { loadStripe } from "@stripe/stripe-js";
const stripe = await loadStripe(process.env.STRIPE_PUBLISHABLE_KEY);


// Arranca todo al cargar DOM
window.addEventListener("DOMContentLoaded", () => {
  initCountryAutocomplete();
  initRanking();
  document.getElementById("start-form")
          .addEventListener("submit",  handleStart);
});


// 1. Autocomplete de países
function initCountryAutocomplete() {
  const datalist = document.getElementById("countries");
  const nombres = Object.values(countriesList.countries)
                        .map(c=>c.name)
                        .sort((a,b)=>a.localeCompare(b));
  for (const name of nombres) {
    const o = document.createElement("option");
    o.value = name;
    datalist.append(o);
  }
}


// 2. Inicializar y mostrar ranking
async function initRanking() {
  // Inicializar Firebase
  const firebaseApp = initializeApp({
    apiKey:            process.env.FIREBASE_API_KEY,
    authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.FIREBASE_PROJECT_ID,
    storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.FIREBASE_APP_ID
  });
  const db = getFirestore(firebaseApp);

  const tbody = document.querySelector("#ranking tbody");
  tbody.innerHTML = "";  // limpia
  const q = query(collection(db, "players"), orderBy("points", "desc"));
  const snap = await getDocs(q);
  let i = 1;
  snap.forEach(docSnap => {
    const { name, country, points } = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="px-3 py-2">${i}</td>
      <td class="px-3 py-2">${name}</td>
      <td class="px-3 py-2">${country}</td>
      <td class="px-3 py-2">${points}</td>
    `;
    tbody.append(tr);
    i++;
  });
}


// 3. Manejar click en “Start” y redirigir a Stripe
async function handleStart(e) {
  e.preventDefault();
  const name    = document.getElementById("name").value.trim();
  const country = document.getElementById("country").value.trim();
  if (!name || !country) {
    alert("Both name and country are required!");
    return;
  }
  const res = await fetch("/api/create-checkout-session", {
    method:  "POST",
    headers: { "Content-Type":"application/json" },
    body:    JSON.stringify({ name, country })
  });
  const { url, error } = await res.json();
  if (url) {
    window.location.href = url;
  } else {
    alert("Stripe Error: " + error);
  }
}
