// Esto se ejecuta en el cliente, las claves de Firebase son públicas de todas formas.
// Solo lee desde variables de entorno inyectadas en Vercel.

export const firebaseConfig = {
  apiKey:              import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:          import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:           import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:       import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:   import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:               import.meta.env.VITE_FIREBASE_APP_ID
};
