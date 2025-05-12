// public/src/firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore  } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCS_wUl5q3uiIPw90_JDlPD_Edan9ZxomQ",
  authDomain: "iq-challenge-global.firebaseapp.com",
  projectId: "iq-challenge-global",
  storageBucket: "iq-challenge-global.firebasestorage.app",
  messagingSenderId: "473166935270",
  appId: "1:473166935270:web:78b54de5628ad11d9fb727",
  measurementId: "G-H53RLP3WEL"
};

// Inicializa Firebase y exporta Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);