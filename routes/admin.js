const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// 🔧 cấu hình cloudinary
cloudinary.config({
  cloud_name: "dngo9bmg5",
  api_key: "932176543241848",
  api_secret: "d7KF3UMfrIH-6H75i5N708N8gQw",
});

// 📂 thư mục tạm lưu ảnh upload
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

// 📤 helper: upload file → cloudinary
async function uploadToCloudinary(filePath, folder = "staff") {
  const res = await cloudinary.uploader.upload(filePath, { folder });
  try {
    await fs.promises.unlink(filePath);
  } catch (e) {}
  return res.secure_url || res.url;
}

function isAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/");
  }
  if (req.session.user.authority !== "ADMIN") {
    // Trả về HTML có SweetAlert2
    return res.send(`
      <html>
        <head>
          <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
        </head>
        <body>
          <script>
            Swal.fire({
              icon: 'error',
              title: 'Truy cập bị từ chối',
              text: 'Bạn không có quyền truy cập vào trang này!',
              confirmButtonText: 'OK'
            }).then(() => {
              window.location.href = "/dashboard"; // đổi về / nếu muốn
            });
          </script>
        </body>
      </html>
    `);
  }
  next();
}

/* GET /admin */
router.get("/", isAdmin, async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const snapshot = await db.collection("Admin").get();
    const staffList = [];
    snapshot.forEach((doc) => {
      staffList.push({ id: doc.id, ...doc.data() });
    });

    res.render("admin", { user: req.session.user, staffList });
  } catch (err) {
    console.error("Lỗi lấy danh sách staff:", err);
    res.status(500).send("Không lấy được danh sách staff!");
  }
});

/* POST /admin/add */
router.post("/add", upload.single("img"), async (req, res) => {
  try {
    const { Name, Email, phone, BirthDay, authority, password } = req.body;

    let imgUrl = "";
    if (req.file) {
      imgUrl = await uploadToCloudinary(req.file.path, "staff");
    }

    const staffDoc = {
      Name,
      Email,
      phone,
      BirthDay,
      authority: authority || "STAFF",
      password,
      img: imgUrl,
      locked: false,
      createdAt: new Date(),
    };

    const docRef = db.collection("Admin").doc();
    staffDoc.id = docRef.id;
    await docRef.set(staffDoc);

    res.redirect("/admin");
  } catch (err) {
    console.error("Lỗi thêm staff:", err);
    res.status(500).send("Không thêm được staff!");
  }
});

/* POST /admin/update/:id */
router.post("/update/:id", upload.single("img"), async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Email, phone, BirthDay, authority, password } = req.body;

    const docRef = db.collection("Admin").doc(id);
    const snapshot = await docRef.get();
    const currentData = snapshot.exists ? snapshot.data() : {};

    let imgUrl = currentData.img || "";
    if (req.file) {
      imgUrl = await uploadToCloudinary(req.file.path, "staff");
    }

    const updateDoc = {
      Name: Name || currentData.Name,
      Email: Email || currentData.Email,
      phone: phone || currentData.phone,
      BirthDay: BirthDay || currentData.BirthDay,
      authority: authority || currentData.authority,
      password: password || currentData.password,
      img: imgUrl,
      updatedAt: new Date(),
    };

    await docRef.update(updateDoc);
    res.redirect("/admin");
  } catch (err) {
    console.error("Lỗi update staff:", err);
    res.status(500).send("Không update được staff!");
  }
});

/* GET /admin/delete/:id */
router.get("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("Admin").doc(id).delete();
    res.redirect("/admin");
  } catch (err) {
    console.error("Lỗi xóa staff:", err);
    res.status(500).send("Không xóa được staff!");
  }
});

/* GET /admin/lock/:id */
router.get("/lock/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("Admin").doc(id).update({ locked: true });
    res.redirect("/admin");
  } catch (err) {
    console.error("Lỗi khóa staff:", err);
    res.status(500).send("Không khóa được staff!");
  }
});

/* GET /admin/unlock/:id */
router.get("/unlock/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("Admin").doc(id).update({ locked: false });
    res.redirect("/admin");
  } catch (err) {
    console.error("Lỗi mở khóa staff:", err);
    res.status(500).send("Không mở khóa được staff!");
  }
});

module.exports = router;
