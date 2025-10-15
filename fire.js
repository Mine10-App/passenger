const firebaseConfig = {
  apiKey: "AIzaSyB2JTBAGNR64d_yRN4g8q9d1GpMfiiHxkE",
  authDomain: "kcardentry.firebaseapp.com",
  projectId: "kcardentry",
  storageBucket: "kcardentry.firebasestorage.app",
  messagingSenderId: "897372470233",
  appId: "1:897372470233:web:e672fc3683b4985b7b37c8",
  measurementId: "G-B2D7VLDT9X"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db; // important!