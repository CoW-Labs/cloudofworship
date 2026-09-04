// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const DEFAULT_AUTH_DOMAIN = "cloud-of-worship.firebaseapp.com";

// Hosts that proxy /__/auth/* straight through to Firebase (see vercel.json).
// Serving the auth handler from our own origin is what stops Safari ITP and
// Chrome's third-party storage partitioning from breaking the Google popup and
// redirect handshake. Anywhere else (localhost, preview deploys, Tauri) falls
// back to the firebaseapp.com domain, which is already authorised.
const PROXIED_AUTH_HOSTS = ["app.cloudofworship.com"];

const resolveAuthDomain = () => {
  if (typeof window === "undefined") return DEFAULT_AUTH_DOMAIN;
  return PROXIED_AUTH_HOSTS.includes(window.location.hostname)
    ? window.location.hostname
    : DEFAULT_AUTH_DOMAIN;
};

const firebaseConfig = {
  apiKey: "AIzaSyAMSSXzdwIML2Gb_M8nouLAbmM1Cs5TYRg",
  authDomain: resolveAuthDomain(),
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
