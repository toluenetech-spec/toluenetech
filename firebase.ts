import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBtBdhAzMHlepR_3bRx3a65fsafeWgD6C8",
  authDomain: "toluene-tech-ed451.firebaseapp.com",
  projectId: "toluene-tech-ed451",
  storageBucket: "toluene-tech-ed451.firebasestorage.app",
  messagingSenderId: "380340149016",
  appId: "1:380340149016:web:d132a48188fb8ded00dc6d"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
