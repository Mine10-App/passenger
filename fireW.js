var firebaseConfigWalkin = {
  apiKey: "AIzaSyCMOPJnK_qpUZcHUWi6EQz-qclrNsDky3U",
  authDomain: "psysko-8d035.firebaseapp.com",
  projectId: "psysko-8d035",
  storageBucket: "psysko-8d035.firebasestorage.app",
  messagingSenderId: "176989826632",
  appId: "1:176989826632:web:bae58e639edbd8d4adf27d",
  measurementId: "G-XL5YJR6L74"
};


// ✅ Check if the secondary app already exists
// ✅ Initialize secondary app
var walkinApp = firebase.apps.find(app => app.name === "walkinApp");
if (!walkinApp) {
  walkinApp = firebase.initializeApp(firebaseConfigWalkin, "walkinApp");
}

window.walkinDb = walkinApp.firestore();

console.log("✅ Walk-in DB (walkinApp) initialized");
