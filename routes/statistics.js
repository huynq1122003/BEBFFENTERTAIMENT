const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");

// API thống kê với filter ngày
router.get("/", async (req, res) => {
  try {
    const collections = ["MV", "Admin", "Artist", "Colab", "notifications"];
    const counts = {};

    // Lấy query param từ client (nếu có)
    const { from, to } = req.query;
    let fromDate = from ? new Date(from) : null;
    let toDate = to ? new Date(to) : null;

    for (let col of collections) {
      let query = db.collection(col);

      // Nếu có field createdAt hoặc Date trong doc thì lọc theo
      if (fromDate) {
        query = query.where("createdAt", ">=", fromDate);
      }
      if (toDate) {
        query = query.where("createdAt", "<=", toDate);
      }

      const snapshot = await query.get();
      counts[col] = snapshot.size;
    }

    res.render("statistics", { user: req.session.user, counts, from, to });
  } catch (err) {
    console.error("Lỗi thống kê:", err);
    res.status(500).send("Không lấy được thống kê!");
  }
});

module.exports = router;
