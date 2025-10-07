const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;

// config cloudinary (dùng env hoặc hardcode như dashboard.js)
cloudinary.config({
  cloud_name: "dngo9bmg5",
  api_key: "932176543241848",
  api_secret: "d7KF3UMfrIH-6H75i5N708N8gQw",
});

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, name);
  }
});
const upload = multer({ storage });

// helper upload local -> cloudinary
async function uploadToCloudinary(filePath, folder='mv') {
  const res = await cloudinary.uploader.upload(filePath, { folder });
  try { await fs.promises.unlink(filePath); } catch(e){}
  return res.secure_url || res.url;
}
/* GET /mv */
router.get("/", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const snapshot = await db.collection("MV").orderBy("Date", "desc").get();
    const mvList = [];
    snapshot.forEach(doc => {
      mvList.push({ id: doc.id, ...doc.data() });
    });

    res.render("mv", { user: req.session.user, mvList });
  } catch (err) {
    console.error("Lỗi lấy danh sách MV:", err);
    res.status(500).send("Không lấy được danh sách MV!");
  }
});

/* POST /mv/add */
/* POST /mv/add */
router.post("/add", upload.single("img"), async (req, res) => {
  try {
    const { Name, Singer, ReleaseDate, YT } = req.body;

    let imgUrl = "";
    if (req.file) {
      imgUrl = await uploadToCloudinary(req.file.path, "mv");
    }

    const mvDoc = {
      Name: Name || "",
      Singer: Singer || "",
      Date: ReleaseDate || "",
      YT: YT || "",
      img: imgUrl,
      createdAt: new Date()
    };

    const docRef = db.collection("MV").doc();
    mvDoc.id = docRef.id;
    await docRef.set(mvDoc);

    res.redirect("/mv");
  } catch (err) {
    console.error("Lỗi thêm MV:", err);
    res.status(500).send("Không thêm được MV!");
  }
});



/* POST /mv/update/:id */
/* POST /mv/update/:id */
router.post("/update/:id", upload.single("img"), async (req, res) => {
  try {
    const { id } = req.params;
    const { Name, Singer, ReleaseDate, YT } = req.body;

    // lấy doc hiện tại để giữ ảnh cũ nếu user không upload ảnh mới
    const docRef = db.collection("MV").doc(id);
    const snapshot = await docRef.get();
    const currentData = snapshot.exists ? snapshot.data() : {};

    let imgUrl = currentData.img || "";

    if (req.file) {
      imgUrl = await uploadToCloudinary(req.file.path, "mv");
    }

    const updateDoc = {
      Name: Name || "",
      Singer: Singer || "",
      Date: ReleaseDate || "",
      YT: YT || "",
      img: imgUrl,
      updatedAt: new Date()
    };

    await docRef.update(updateDoc);

    res.redirect("/mv");
  } catch (err) {
    console.error("Lỗi update MV:", err);
    res.status(500).send("Không update được MV!");
  }
});


/* GET /mv/delete/:id */
router.get("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.collection("MV").doc(id).delete();
    res.redirect("/mv");
  } catch (err) {
    console.error("Lỗi xóa MV:", err);
    res.status(500).send("Không xóa được MV!");
  }
});


module.exports = router;
