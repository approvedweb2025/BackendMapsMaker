// controllers/photo.controller.js
const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model');

// =================================================================
// HELPER UTILITIES FOR BETTER ERROR HANDLING
// =================================================================

/**
 * @description Centralized error handling ke liye custom error class.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @description Async functions ko wrap karne ke liye helper, taaki 'try-catch' har jagah na likhna pade.
 * @param {Function} fn - Woh async function jise wrap karna hai.
 * @returns {Function} - Error handling ke saath naya function.
 */
const catchAsync = fn => (req, res, next) => fn(req, res, next).catch(next);

// =================================================================
// CORE LOGIC (FROM YOUR FIRST FILE)
// =================================================================

// ✅ Google Drive se file download karke buffer mein store karta hai.
const downloadFileToBuffer = async (fileId, accessToken) => {
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer'
    }
  );
  return Buffer.from(response.data, 'binary');
};

// ✅ Latitude aur Longitude se jagah ki details nikalta hai.
const getPlaceDetails = async (lat, lng) => {
  // Best Practice: API Key ko hardcode na karein. Environment variable ka istemal karein.
  if (!process.env.GOOGLE_GEOCODING_API_KEY) {
    console.error("❌ Google Geocoding API key missing! .env file mein add karein.");
    return { district: "", tehsil: "", village: "", country: "" };
  }

  try {
    const res = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_GEOCODING_API_KEY }
    });

    if (res.data.status === "OK" && res.data.results.length > 0) {
      const components = res.data.results[0].address_components;
      const extract = (type) => components.find((c) => c.types.includes(type))?.long_name || "";

      return {
        district: extract("administrative_area_level_2") || extract("administrative_area_level_1") || "",
        tehsil: extract("administrative_area_level_3") || extract("sublocality_level_1") || "",
        village: extract("locality") || extract("sublocality") || extract("neighborhood") || "",
        country: extract("country") || ""
      };
    }
    return { district: "", tehsil: "", village: "", country: "" };
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return { district: "", tehsil: "", village: "", country: "" };
  }
};

// ✅ Google Drive se images sync karke database mein save karta hai.
const syncImages = catchAsync(async (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next(new AppError('Aap authenticated nahi hain', 401));
  }
  const accessToken = req.user.accessToken;

  let files = [];
  let nextPageToken = null;

  do {
    const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: "mimeType contains 'image/' and trashed=false",
        fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
        pageToken: nextPageToken
      }
    });
    files.push(...(driveResponse.data.files || []));
    nextPageToken = driveResponse.data.nextPageToken;
  } while (nextPageToken);

  console.log(`✅ Total files fetched: ${files.length}`);

  for (const file of files) {
    try {
      if (await Image.findOne({ fileId: file.id })) continue;

      const imageBuffer = await downloadFileToBuffer(file.id, accessToken);
      let latitude = null, longitude = null;
      let timestamp = new Date(file.createdTime || Date.now());

      if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
        try {
          const exifData = await exifr.parse(imageBuffer);
          if (exifData) {
            latitude = exifData.latitude || null;
            longitude = exifData.longitude || null;
            if (exifData.DateTimeOriginal) timestamp = new Date(exifData.DateTimeOriginal);
          }
        } catch (err) {
          console.warn(`⚠️ EXIF error for ${file.name}:`, err.message);
        }
      }

      const placeDetails = (latitude && longitude) ? await getPlaceDetails(latitude, longitude) : {};

      await Image.create({
        fileId: file.id, name: file.name, mimeType: file.mimeType, imageData: imageBuffer,
        latitude, longitude, timestamp, uploadedBy: req.user.email, lastCheckedAt: new Date(),
        ...placeDetails
      });
    } catch (fileErr) {
      console.error(`❌ Error processing file ${file.name}:`, fileErr.message);
    }
  }

  // Best Practice: Frontend URL ko environment variable se lein.
  res.redirect(`${process.env.FRONTEND_URL || '/home'}`);
});

// ✅ Sabhi photos ka metadata database se nikalta hai (bina image data ke).
const getPhotos = catchAsync(async (req, res, next) => {
  const photos = await Image.find().select('-imageData').sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: photos.length, data: { photos } });
});

// ✅ Database ID se ek single image ka binary data bhejta hai.
const getImageDataById = catchAsync(async (req, res, next) => {
  const image = await Image.findById(req.params.id);
  if (!image || !image.imageData) {
    return next(new AppError('Is ID se koi image nahi mili', 404));
  }
  res.set('Content-Type', image.mimeType);
  res.send(image.imageData);
});

// ✅ Ek user (uploader) ki saari images nikalta hai.
const getImagesByUploadedBy = catchAsync(async (req, res, next) => {
    const { email } = req.params;
    if (!email) {
        return next(new AppError('Email address nahi diya gaya', 400));
    }
    const photos = await Image.find({ 
        uploadedBy: email, 
        longitude: { $ne: null }, 
        latitude: { $ne: null } 
    }).select('-imageData');
    
    res.status(200).json({ status: 'success', results: photos.length, data: { photos } });
});

// =================================================================
// STATS FUNCTIONS (MERGED FROM YOUR FIRST FILE)
// =================================================================

// ✅ Monthly stats calculate karta hai.
const getImageStatsByMonth = catchAsync(async (req, res, next) => {
    const monthlyStats = await Image.aggregate([
      { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { month: "$_id.month", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]);
    const uniqueUploaders = [...new Set(monthlyStats.map(s => s.uploadedBy).filter(Boolean))];
    res.status(200).json({ status: 'success', data: { stats: monthlyStats, uniqueUploaders } });
});

// ✅ Yearly stats calculate karta hai.
const getImageStatsByYear = catchAsync(async (req, res, next) => {
    const yearlyStats = await Image.aggregate([
      { $group: { _id: { year: { $dateToString: { format: "%Y", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { year: "$_id.year", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { year: 1 } }
    ]);
    res.status(200).json({ status: 'success', data: { stats: yearlyStats } });
});

// ✅ Daily stats calculate karta hai.
const getImageStatsByDay = catchAsync(async (req, res, next) => {
    const dailyStats = await Image.aggregate([
      { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { date: "$_id.date", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { date: 1 } }
    ]);
    res.status(200).json({ status: 'success', data: { stats: dailyStats } });
});

// =================================================================
// SPECIFIC EMAIL FUNCTIONS (REFACTORED FOR BETTER PRACTICE)
// =================================================================

// Note: Alag-alag function banane ke bajaye `getImagesByUploadedBy` ka istemal karna behtar hai.
// Emails ko hardcode karne ke bajaye .env file mein rakhein.

const getFirstEmailImage = (req, res, next) => {
  req.params.email = process.env.FIRST_EMAIL_USER || 'mhuzaifa8519@gmail.com';
  getImagesByUploadedBy(req, res, next);
};

const getSecondEmailImage = (req, res, next) => {
  req.params.email = process.env.SECOND_EMAIL_USER || 'mhuzaifa86797@gmail.com';
  getImagesByUploadedBy(req, res, next);
};

const getThirdEmailImage = (req, res, next) => {
  req.params.email = process.env.THIRD_EMAIL_USER || 'muhammadjig8@gmail.com';
  getImagesByUploadedBy(req, res, next);
};


// =================================================================
// EXPORTS
// =================================================================

module.exports = {
  syncImages,
  getPhotos,
  getImageDataById,
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
  getImagesByUploadedBy,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
};
