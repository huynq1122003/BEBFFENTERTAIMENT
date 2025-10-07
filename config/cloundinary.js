const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dngo9bmg5",
  api_key: process.env.CLOUDINARY_API_KEY || "932176543241848",
  api_secret: process.env.CLOUDINARY_API_SECRET || "d7KF3UMfrIH-6H75i5N708N8gQw",
});

module.exports = cloudinary;