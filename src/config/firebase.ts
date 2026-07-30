// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBzjFmaksidSwwqA59xn6pzcu1A9PG6Qik",
  authDomain: "reflection-app-a3a35.firebaseapp.com",
  projectId: "reflection-app-a3a35",
  storageBucket: "reflection-app-a3a35.firebasestorage.app",
  messagingSenderId: "482285376406",
  appId: "1:482285376406:web:15e799d1da80c5c2ae83b7",
  measurementId: "G-XBWYLJFJ5B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Only initialize analytics if running on web or if needed, it might crash on some React Native setups
// const analytics = getAnalytics(app);

export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
