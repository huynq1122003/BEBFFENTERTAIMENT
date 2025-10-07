const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

// cấu hình Cloudinary (set env vars: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
cloudinary.config({
  cloud_name: "dngo9bmg5",
  api_key: "932176543241848",
  api_secret: "d7KF3UMfrIH-6H75i5N708N8gQw",
});

// multer lưu file tạm trong uploads/
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const name = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, name);
  }
});
const upload = multer({ storage });

// helper upload file local -> cloudinary và xóa file local
async function uploadToCloudinary(filePath, folder='artists') {
  const res = await cloudinary.uploader.upload(filePath, { folder });
  // xóa file tạm
  try { await fs.promises.unlink(filePath); } catch(e){ /* ignore */ }
  return res.secure_url || res.url;
}

/* GET /dashboard */
router.get("/", async (req, res) => {
  if (!req.session.user) return res.redirect("/");

  try {
    const snapshot = await db.collection("Artist").get();
    const artists = [];
    snapshot.forEach(doc => artists.push({ id: doc.id, ...doc.data() }));
    res.render("dashboard", { user: req.session.user, artists });
  } catch (err) {
    console.error("Lỗi lấy danh sách nghệ sĩ:", err);
    res.status(500).send("Không lấy được danh sách nghệ sĩ!");
  }
});

/* POST /dashboard/add */
router.post("/add", upload.fields([
  { name: 'img', maxCount: 1 },
  { name: 'listMVImage', maxCount: 50 }
]), async (req, res) => {
  try {
    // các trường text từ form
    const {
      Name, aka, BirthDay, position, Address,
      biography, ReleaseInformation, StyleAndOrientation, Typicalhits
    } = req.body;

    // Xử lý Typicalhits: nếu người nhập nhiều dòng -> mảng
    let typicalArray = [];
    if (Typicalhits) {
      if (Array.isArray(Typicalhits)) {
        typicalArray = Typicalhits.flatMap(t => String(t).split(/\r?\n/).map(s => s.trim()).filter(Boolean));
      } else {
        typicalArray = String(Typicalhits).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      }
    }

    // upload ảnh artist (nếu có)
    let imgUrl = null;
    if (req.files && req.files['img'] && req.files['img'][0]) {
      const filePath = req.files['img'][0].path;
      imgUrl = await uploadToCloudinary(filePath, 'artists');
    }

    // Xử lý listMV: tên, link (từ req.body as arrays), images từ req.files.listMVImage
    const mvNames = req.body['listMVName[]'] || req.body.listMVName || []; // tùy cách gửi form
    const mvLinks = req.body['listMVLink[]'] || req.body.listMVLink || [];
    const mvFiles = req.files && req.files['listMVImage'] ? req.files['listMVImage'] : [];

    // Normalize to arrays
    const normalize = v => (v === undefined ? [] : (Array.isArray(v) ? v : [v]));
    const names = normalize(mvNames);
    const links = normalize(mvLinks);

    // Build listMV array, đảm bảo thứ tự: names[i], links[i], files[i] (files order theo thứ tự input)
    const maxLen = Math.max(names.length, links.length, mvFiles.length);
    const listMV = [];

    // nếu user không nhập tên nhưng vẫn upload file/link, vẫn push
    for (let i = 0; i < maxLen; i++) {
      let imageUrl = null;
      if (mvFiles[i]) {
        imageUrl = await uploadToCloudinary(mvFiles[i].path, 'artists/mv');
      }
      const item = {
        NameMV: names[i] ? names[i] : '',
        linkYT: links[i] ? links[i] : '',
        image: imageUrl || ''
      };
      // optional: chỉ push nếu có ít nhất 1 giá trị
      if (item.NameMV || item.linkYT || item.image) listMV.push(item);
    }

    // Tạo document object
    const artistDoc = {
      Name: Name || '',
      aka: aka || '',
      BirthDay: BirthDay || '',
      position: position || '',
      Address: Address || '',
      biography: biography || '',
      ReleaseInformation: ReleaseInformation || '',
      StyleAndOrientation: StyleAndOrientation || '',
      Typicalhits: typicalArray,
      img: imgUrl || '',
      listMV: listMV,
      createdAt: new Date()
    };

    // Lưu vào Firestore
   const docRef = db.collection("Artist").doc();
artistDoc.id = docRef.id; // thêm trường id vào document

// Lưu vào Firestore
await docRef.set(artistDoc);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Lỗi thêm nghệ sĩ:", err);
    res.status(500).send("Không thêm được nghệ sĩ!");
  }
});

/* GET /artists/delete/:id */
router.get("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Xoá document trong collection Artists
    await db.collection("Artist").doc(id).delete();

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Lỗi xóa nghệ sĩ:", err);
    res.status(500).send("Không xóa được nghệ sĩ!");
  }
});

/* POST /artists/update/:id */
/* POST /artists/update/:id */
router.post("/update/:id", upload.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      Name, aka, BirthDay, position, Address,
      biography, ReleaseInformation, StyleAndOrientation, Typicalhits
    } = req.body;

    // xử lý Typicalhits -> mảng
    let typicalArray = [];
    if (Typicalhits) {
      typicalArray = String(Typicalhits).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }

    // map các file upload theo fieldname để dễ tìm: fileMap['listMVImage-0'] = fileObj
    const fileMap = {};
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(f => {
        fileMap[f.fieldname] = f;
      });
    }

    // nếu có file 'img' (avatar artist) upload và replace
    let imgUrl = null;
    if (fileMap['img']) {
      imgUrl = await uploadToCloudinary(fileMap['img'].path, 'artists');
    }

    // Normalize các mảng listMV (tên, link, existing image)
    const normalize = v => (v === undefined ? [] : (Array.isArray(v) ? v : [v]));

    const names = normalize(req.body['listMVName[]'] || req.body.listMVName);
    const links = normalize(req.body['listMVLink[]'] || req.body.listMVLink);
    const existingImgs = normalize(req.body['existingMVImage[]'] || req.body.existingMVImage);

    const maxLen = Math.max(names.length, links.length, existingImgs.length);
    const listMV = [];

    for (let i = 0; i < maxLen; i++) {
      // kiểm tra file thay cho hàng i có tên fieldname là listMVImage-i
      const fieldName = `listMVImage-${i}`;
      let imageUrl = '';

      if (fileMap[fieldName]) {
        // upload file mới lên Cloudinary
        imageUrl = await uploadToCloudinary(fileMap[fieldName].path, 'artists/mv');
      } else {
        // giữ ảnh cũ (nếu có)
        imageUrl = existingImgs[i] || '';
      }

      const item = {
        NameMV: names[i] ? names[i] : '',
        linkYT: links[i] ? links[i] : '',
        image: imageUrl || ''
      };

      if (item.NameMV || item.linkYT || item.image) listMV.push(item);
    }

    const updateDoc = {
      Name: Name || '',
      aka: aka || '',
      BirthDay: BirthDay || '',
      position: position || '',
      Address: Address || '',
      biography: biography || '',
      ReleaseInformation: ReleaseInformation || '',
      StyleAndOrientation: StyleAndOrientation || '',
      Typicalhits: typicalArray,
      listMV: listMV,
      updatedAt: new Date()
    };

    if (imgUrl) updateDoc.img = imgUrl;

    // Lưu cập nhật
    await db.collection("Artist").doc(id).update(updateDoc);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Lỗi update nghệ sĩ (listMV):", err);
    res.status(500).send("Không cập nhật được nghệ sĩ!");
  }
});



module.exports = router;
