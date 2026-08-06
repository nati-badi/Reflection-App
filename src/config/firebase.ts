import { initializeApp } from "firebase/app";
// @ts-ignore
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

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

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export default app;
