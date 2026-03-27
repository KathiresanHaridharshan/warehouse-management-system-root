import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB-7Qu_ehemnT05-z2DZFD5_CItBYPefZw",
  authDomain: "orel-warehouse-management.firebaseapp.com",
  projectId: "orel-warehouse-management",
  storageBucket: "orel-warehouse-management.firebasestorage.app",
  messagingSenderId: "739736852955",
  appId: "1:739736852955:web:c0e2266a135d96f6856ffe"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
