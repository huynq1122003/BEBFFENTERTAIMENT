const express = require("express");
const router = express.Router();
const { db } = require("../module/firebaseconfig");
const ExcelJS = require("exceljs"); // dùng để tạo file excel

// ✅ Hàm lấy thời gian chuẩn Việt Nam
function getVietnamTime() {
  const now = new Date();
  return new Date(now.getTime() + 7 * 60 * 60 * 1000);
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

// GET trang chấm công
router.get("/", isAdmin, async (req, res) => {
  if (!req.session.user) return res.redirect("/");
  const { date } = req.query;
  const selectedDate = date || getVietnamTime().toISOString().slice(0, 10);

  try {
    const staffsSnapshot = await db.collection("Admin").get();
    const staffs = staffsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const attendanceSnapshot = await db
      .collection("attendance")
      .where("date", "==", selectedDate)
      .get();

    const attendance = {};
    attendanceSnapshot.forEach(doc => {
      attendance[doc.data().staffId] = doc.data();
    });

    res.render("attendance", { staffs, attendance, selectedDate, user: req.session.user });
  } catch (err) {
    console.error("Lỗi load dữ liệu:", err);
    res.status(500).send("Lỗi server");
  }
});

// POST check-in
router.post("/checkin/:staffId", async (req, res) => {
  const staffId = req.params.staffId;
  const note = req.body.note || "";

  // ✅ Giờ Việt Nam
  const vnTime = getVietnamTime();
  const date = req.body.date || vnTime.toISOString().slice(0, 10);
  const time = vnTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  try {
    await db.collection("attendance").doc(`${staffId}_${date}`).set({
      staffId,
      date,
      checkIn: time,
      note
    }, { merge: true });

    res.redirect("/attendance?date=" + date);
  } catch (err) {
    console.error("Lỗi checkin:", err);
    res.status(500).send("Lỗi checkin");
  }
});

// POST check-out
router.post("/checkout/:staffId", async (req, res) => {
  const staffId = req.params.staffId;
  const note = req.body.note || "";

  // ✅ Giờ Việt Nam
  const vnTime = getVietnamTime();
  const date = req.body.date || vnTime.toISOString().slice(0, 10);
  const time = vnTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  try {
    const docRef = db.collection("attendance").doc(`${staffId}_${date}`);
    const docSnap = await docRef.get();

    let oldNote = "";
    if (docSnap.exists) {
      const data = docSnap.data();
      oldNote = data.note || "";
    }

    const newNote = oldNote && note ? `${oldNote} | ${note}` : (note || oldNote);

    await docRef.set({
      staffId,
      date,
      checkOut: time,
      note: newNote
    }, { merge: true });

    res.redirect("/attendance?date=" + date);
  } catch (err) {
    console.error("Lỗi checkout:", err);
    res.status(500).send("Lỗi checkout");
  }
});

// Export Excel theo tháng
router.get("/export", async (req, res) => {
  try {
    const { date } = req.query;
    let attendanceSnap;
    if (date) {
      const month = date.slice(0, 7); // YYYY-MM
      attendanceSnap = await db.collection("attendance")
        .where("date", ">=", month + "-01")
        .where("date", "<=", month + "-31")
        .get();
    } else {
      attendanceSnap = await db.collection("attendance").get();
    }

    // Chuẩn bị workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Attendance");

    worksheet.columns = [
      { header: "Tên nhân viên", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Số điện thoại", key: "phone", width: 20 },
      { header: "Ngày", key: "date", width: 15 },
      { header: "Check In", key: "checkIn", width: 15 },
      { header: "Check Out", key: "checkOut", width: 15 },
      { header: "Ghi chú", key: "note", width: 30 },
    ];

    for (const doc of attendanceSnap.docs) {
      const att = doc.data();
      const staffRef = db.collection("Admin").doc(att.staffId);
      const staffDoc = await staffRef.get();

      let staff = {};
      if (staffDoc.exists) {
        staff = staffDoc.data();
      }

      worksheet.addRow({
        name: staff.Name || "N/A",
        email: staff.Email || "",
        phone: staff.phone || "",
        date: att.date || "",
        checkIn: att.checkIn || "",
        checkOut: att.checkOut || "",
        note: att.note || "",
      });
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=attendance.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).send("Có lỗi khi xuất Excel");
  }
});

module.exports = router;
