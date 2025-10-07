function checkAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // cho qua nếu đã login
  } else {
    return res.redirect("/"); // chưa login → quay về trang login
  }
}

module.exports = checkAuth;