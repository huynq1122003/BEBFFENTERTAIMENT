// Import the functions you need from the SDKs you need

const admin = require('firebase-admin');

let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  // Khi chạy trên Render hoặc môi trường có set biến
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } catch (err) {
    console.error("Lỗi parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
    process.exit(1);
  }
} else {
  // Khi chạy local thì đọc từ file FirebasConfig.json
  serviceAccount = require('../FireBaseConfig.json');
}



admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  apiKey: "AIzaSyBh-kFRKtrEsqdhLGfSBAtsxN2Gz9HzyUM",
  authDomain: "bff-entertaiment.firebaseapp.com",
  projectId: "bff-entertaiment",
  storageBucket: "bff-entertaiment.firebasestorage.app",
  messagingSenderId: "186804913564",
  appId: "1:186804913564:web:6436459e7206343d80f459",
  measurementId: "G-WPNJY5KKFX"
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

module.exports = { db, admin };