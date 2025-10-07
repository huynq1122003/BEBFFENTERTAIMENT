const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;

// Middleware check login
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/");
  next();
}

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: "dngo9bmg5",
  api_key: "932176543241848",
  api_secret: "d7KF3UMfrIH-6H75i5N708N8gQw",
});

// Multer upload
const upload = multer({ dest: "uploads/" });

// Trang settings
router.get("/", requireLogin, (req, res) => {
   if (!req.session.user) return res.redirect("/");
  res.render("settings", { user: req.session.user });
});

// Update avatar
router.post("/update-avatar", requireLogin, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.redirect("/settings");

    const result = await cloudinary.uploader.upload(req.file.path, { folder: "avatars" });
    const avatarUrl = result.secure_url;

    // Update Firestore
    const usersRef = db.collection("Admin");
    const snapshot = await usersRef.where("Email", "==", req.session.user.email).get();
    snapshot.forEach(async (doc) => {
      await doc.ref.update({ img: avatarUrl });
    });

    // Update session
    req.session.user.img = avatarUrl;
    res.redirect("/settings");
  } catch (err) {
    console.error("Lỗi update avatar:", err);
    res.redirect("/settings");
  }
});

// Check mật khẩu cũ
router.post("/check-password", requireLogin, express.json(), async (req, res) => {
  const { oldPassword } = req.body;
  try {
    const usersRef = db.collection("Admin");
    const snapshot = await usersRef.where("Email", "==", req.session.user.email).get();

    if (snapshot.empty) return res.json({ success: false });

    let userData;
    snapshot.forEach(doc => { userData = doc.data(); });

    if (userData.password === oldPassword) {
      return res.json({ success: true });
    } else {
      return res.json({ success: false });
    }
  } catch (err) {
    console.error("Lỗi check password:", err);
    res.json({ success: false });
  }
});

// Đổi mật khẩu
router.post("/change-password", requireLogin, async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  try {
    if (newPassword !== confirmPassword) {
      return res.send("❌ Mật khẩu mới không khớp!");
    }

    const usersRef = db.collection("Admin");
    const snapshot = await usersRef.where("Email", "==", req.session.user.email).get();

    let userDoc;
    snapshot.forEach(doc => { userDoc = doc; });

    if (!userDoc) return res.send("Không tìm thấy user");

    if (userDoc.data().password !== oldPassword) {
      return res.send("❌ Mật khẩu cũ không đúng!");
    }

    await userDoc.ref.update({ password: newPassword });
    res.send("✅ Đổi mật khẩu thành công!");
  } catch (err) {
    console.error("Lỗi đổi mật khẩu:", err);
    res.send("Có lỗi xảy ra!");
  }
});

// Xóa tài khoản
router.post("/delete", requireLogin, async (req, res) => {
  try {
    const usersRef = db.collection("Admin");
    const snapshot = await usersRef.where("Email", "==", req.session.user.email).get();

    snapshot.forEach(async (doc) => {
      await doc.ref.delete();
    });

    req.session.destroy(() => {
      res.redirect("/");
    });
  } catch (err) {
    console.error("Lỗi xóa tài khoản:", err);
    res.redirect("/settings");
  }
});

module.exports = router;
