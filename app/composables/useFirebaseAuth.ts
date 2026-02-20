// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAMSSXzdwIML2Gb_M8nouLAbmM1Cs5TYRg",
  authDomain: "cloud-of-worship.firebaseapp.com",
  projectId: "cloud-of-worship",
  storageBucket: "cloud-of-worship.appspot.com",
  messagingSenderId: "666115758673",
  appId: "1:666115758673:web:783d665767c870f3ae3670",
  measurementId: "G-Z3S9DL6WMG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

const useFirebaseAuth = () => auth

export default useFirebaseAuth
