const express = require('express');
const router = express.Router();

// ✅ Controller se saare zaroori functions import karein
const {
  // Syncing and Processing
  syncImages,
  processSyncQueue, // ✅ Naya background processor function

  // Data Serving
  getPhotos,
  getImageDataById,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,

  // Stats
  getImageStatsByMonth,
  // (Aap stats ke liye baaki functions bhi yahan import kar sakte hain agar zaroorat ho)
  // getImageStatsByYear,
  // getImageStatsByDay,

} = require('../controllers/photo.controller');


// ==========================================================
// SECTION: Image Syncing and Processing Routes
// ==========================================================

// ✅ TRIGGER SYNC: Yeh route user ki request par call hota hai.
// Yeh sirf Google Drive se file list fetch karke queue banata hai.
router.get('/sync-images', syncImages);

// ✅ PROCESS QUEUE: Yeh route Vercel Cron Job se har minute call hoga.
// Yeh background mein queue se images ko chote batches mein process karta hai.
router.get('/process-queue', processSyncQueue);


// ==========================================================
// SECTION: Data Fetching Routes (For Frontend)
// ==========================================================

// ✅ Saari photos ka metadata (image data ke bina) get karein
router.get('/get-photos', getPhotos);

// ✅ Database ID se ek single image ka binary data (file) get karein
router.get('/image-data/:id', getImageDataById);

// ✅ Ek specific user (email) ki saari photos get karein
router.get('/getImages/:uploadedBy', getImagesByUploadedBy);

// ✅ Hardcoded email endpoints
router.get('/get1stEmailPhotos', getFirstEmailImage);
router.get('/get2ndEmailPhotos', getSecondEmailImage);
router.get('/get3rdEmailPhotos', getThirdEmailImage);


// ==========================================================
// SECTION: Stats Routes
// ==========================================================

// ✅ Monthly stats get karein
router.get('/get-image-by-month', getImageStatsByMonth);
// Aap yahan yearly aur daily stats ke liye bhi routes add kar sakte hain


module.exports = router;
