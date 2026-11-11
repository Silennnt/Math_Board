import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
	apiKey: "AIzaSyCnBqcNhrvVWPMdgdWaCEs0cQp7zvrXWXY",
	authDomain: "math-board-f3a51.firebaseapp.com",
	projectId: "math-board-f3a51",
	databaseURL:
		"https://math-board-f3a51-default-rtdb.europe-west1.firebasedatabase.app",
	storageBucket: "math-board-f3a51.firebasestorage.app",
	messagingSenderId: "571044598721",
	appId: "1:571044598721:web:ddc9a838387d32a2f75540",
	measurementId: "G-3SPHZ4EFT3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);
