// routes/photo.route.js
const express = require('express');
const router = express.Router();
const {
  syncImages,
  getPhotos,
  getImageDataById,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
  getImageStatsByMonth,
} = require('../controllers/photo.controller');

// Image Syncing Route
router.get('/sync-images', syncImages);

// Data Fetching Routes
router.get('/get-photos', getPhotos);
router.get('/image-data/:id', getImageDataById);
router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

// Hardcoded email endpoints
router.get('/get1stEmailPhotos', getFirstEmailImage);
router.get('/get2ndEmailPhotos', getSecondEmailImage);
router.get('/get3rdEmailPhotos', getThirdEmailImage);

// Stats Route
router.get('/get-image-by-month', getImageStatsByMonth);

module.exports = router;
