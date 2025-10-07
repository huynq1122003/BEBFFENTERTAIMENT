const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const crypto = require("crypto");
let otpStore = {}; // lưu OTP tạm
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // Gmail của bạn
    pass: process.env.EMAIL_PASS  // App Password (16 ký tự), không phải pass Gmail thường
  }
});
// GET login page
router.get("/", (req, res) => {
  res.render("index", { message: null });
});

// POST xử lý login
router.post("/", async (req, res) => {
  const { email, password } = req.body;

  try {
    const usersRef = db.collection("Admin");
    const snapshot = await usersRef
      .where("Email", "==", email)
      .where("password", "==", password)
      .get();

    if (snapshot.empty) {
      return res.render("index", { message: "❌ Sai email hoặc mật khẩu!" });
    }

    let userData;
    snapshot.forEach(doc => {
      userData = { id: doc.id, ...doc.data() };
    });

    // ✅ Check tài khoản bị khóa
    if (userData.locked) {
      return res.render("index", { message: "🔒 Tài khoản đã bị khóa, vui lòng liên hệ Admin!" });
    }

    // Lưu session
    req.session.user = {
      id: userData.id,
      email: userData.Email,
      name: userData.Name,
      authority: userData.authority,
      img: userData.img
    };

    // Redirect dashboard
    res.redirect("/dashboard");

  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.render("index", { message: "⚠️ Có lỗi xảy ra, vui lòng thử lại!" });
  }
});

// Logout
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

router.post("/forgot", async (req, res) => {
  const { email } = req.body;
  const otp = crypto.randomInt(100000, 999999).toString();

  otpStore[email] = { code: otp, expires: Date.now() + 5 * 60 * 1000 };

  try {
    await transporter.sendMail({
      from: `"BFF Entertainment" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Mã OTP khôi phục mật khẩu",
      text: `Mã OTP của bạn là: ${otp}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi gửi mail:", err);
    res.json({ success: false, message: "Không gửi được email" });
  }
});

// API reset mật khẩu
router.post("/reset", async (req, res) => {
  const { email, otp, password } = req.body;
  const record = otpStore[email];
  if (!record || record.code !== otp || Date.now() > record.expires) {
    return res.json({ success: false, message: "OTP sai hoặc đã hết hạn" });
  }

  try {
    await db.collection("Admin").doc(email).update({ password });
    delete otpStore[email];
    res.json({ success: true });
  } catch (err) {
    console.error("Lỗi reset:", err);
    res.json({ success: false, message: "Không đổi được mật khẩu" });
  }
});
module.exports = router;
