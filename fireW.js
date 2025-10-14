var firebaseConfigWalkin = {
  apiKey: "AIzaSyAc8RRBC5Cm_wCdoJuUPd1Qh5yHLHRqPY0",
  authDomain: "walkin-56b47.firebaseapp.com",
  projectId: "walkin-56b47",
  storageBucket: "walkin-56b47.firebasestorage.app",
  messagingSenderId: "513281379731",
  appId: "1:513281379731:web:abc139deadda3a18566c66",
  measurementId: "G-1WHEBZWLZ4"
};


// ✅ Check if the secondary app already exists
// ✅ Initialize secondary app
var walkinApp = firebase.apps.find(app => app.name === "walkinApp");
if (!walkinApp) {
  walkinApp = firebase.initializeApp(firebaseConfigWalkin, "walkinApp");
}

window.walkinDb = walkinApp.firestore();
console.log("✅ Walk-in DB (walkinApp) initialized");