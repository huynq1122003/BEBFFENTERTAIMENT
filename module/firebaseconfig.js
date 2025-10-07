// firebaseconfig.js
const admin = require("firebase-admin");

let serviceAccount;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    console.log("✅ Service account loaded from environment variable");
  } catch (err) {
    console.error("❌ Lỗi parse GOOGLE_APPLICATION_CREDENTIALS_JSON:", err);
    process.exit(1);
  }
} else {
  // fallback khi chạy local
  serviceAccount = require("../FireBaseConfig.json");
  console.log("✅ Service account loaded from local file");
}

// Khởi tạo app nếu chưa có
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

module.exports = { db, admin };
