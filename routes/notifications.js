const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// ✅ config cloudinary
cloudinary.config({
  cloud_name: "dngo9bmg5",
  api_key: "932176543241848",
  api_secret: "d7KF3UMfrIH-6H75i5N708N8gQw",
});

// ✅ Multer để lưu tạm ảnh upload
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, name);
  },
});
const upload = multer({ storage });

// ✅ Hàm upload từ local lên cloudinary
async function uploadToCloudinary(filePath, folder = "notifications") {
  const res = await cloudinary.uploader.upload(filePath, { folder });
  try {
    await fs.promises.unlink(filePath); // xóa file local sau khi upload
  } catch (e) {}
  return res.secure_url || res.url;
}

/* ================== ROUTES ================== */

// GET /notifications → hiển thị danh sách
router.get("/", async (req, res) => {
  if (!req.session.user) return res.redirect("/");
  try {
    const snapshot = await db.collection("notifications").orderBy("Date", "desc").get();
    let notifications = [];

    snapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Render view notifications.ejs
    res.render("notifications", { user: req.session.user, notifications });
  } catch (error) {
    console.error("Lỗi:", error);
    res.status(500).send("Lỗi server");
  }
});

// POST /notifications/add → thêm thông báo
router.post("/add", upload.single("image"), async (req, res) => {
  try {
    const { title, content } = req.body;

    let imgUrl = "";
    if (req.file) {
      imgUrl = await uploadToCloudinary(req.file.path, "notifications");
    }

    const notiDoc = {
      title: title || "",
      content: content || "",
      Date: new Date(),
      image: imgUrl,
      createdAt: new Date(),
    };

    const docRef = db.collection("notifications").doc();
    notiDoc.id = docRef.id;
    await docRef.set(notiDoc);

    res.redirect("/notifications");
  } catch (error) {
    console.error("Lỗi thêm thông báo:", error);
    res.status(500).send("Không thêm được thông báo!");
  }
});

// GET /notifications/delete/:id → xóa
router.get("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("notifications").doc(id).delete();
    res.redirect("/notifications");
  } catch (error) {
    console.error("Lỗi xóa thông báo:", error);
    res.status(500).send("Không xóa được thông báo!");
  }
});

module.exports = router;

