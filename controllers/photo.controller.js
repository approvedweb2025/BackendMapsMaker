const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model');
// SyncQueue model ki ab zaroorat nahi hai.

/**
 * Helper function: Google Drive se file download karke buffer mein store karta hai.
 */
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

/**
 * Helper function: GPS coordinates se location details (district, tehsil, etc.) nikalta hai.
 */
const getPlaceDetails = async (lat, lng) => {
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
    return {};
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return {};
  }
};


// ====================================================================
// SECTION: DIRECT SYNC & PROCESSING (WITHOUT CRON JOB)
// ====================================================================

/**
 * Sync Trigger - Direct processing without a queue.
 * Yeh function user ki request par call hota hai aur Vercel timeout (10-15s) se bachne ke liye
 * ek chote batch (e.g., 15 files) ko foran process karta hai.
 */
const syncImages = async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).send('Not authenticated');
  }
  const { accessToken, email } = req.user;

  try {
    // Step 1: Google Drive se sabse nayi 15 image files ki list fetch karein.
    // Zyada files fetch karne par Vercel ka serverless function timeout ho sakta hai.
    const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: "mimeType contains 'image/' and trashed=false",
        fields: 'files(id, name, mimeType, createdTime)',
        pageSize: 15, // Har sync request par sirf 15 files process karein
        orderBy: 'createdTime desc' // Sabse nayi files pehle
      }
    });

    const files = driveResponse.data.files || [];
    console.log(`✅ Found ${files.length} recent files for user ${email}. Starting immediate processing...`);

    let processedCount = 0;

    // Step 2: Har file ko ek-ek karke foran process karein.
    for (const file of files) {
      try {
        // Agar image pehle se database mein hai, to usko skip kar dein.
        const imageExists = await Image.findOne({ fileId: file.id });
        if (imageExists) {
          console.log(`Skipping already existing file: ${file.name}`);
          continue;
        }

        console.log(`Processing file: ${file.name}...`);
        
        // A. File ko buffer mein download karein
        const imageBuffer = await downloadFileToBuffer(file.id, accessToken);
        
        // B. EXIF data (GPS, timestamp) nikalein
        let latitude = null, longitude = null, timestamp = new Date(file.createdTime);
        try {
          const exifData = await exifr.parse(imageBuffer);
          if (exifData) {
            latitude = exifData.latitude || null;
            longitude = exifData.longitude || null;
            if (exifData.DateTimeOriginal) {
              timestamp = new Date(exifData.DateTimeOriginal);
            }
          }
        } catch (exifErr) { 
            console.warn(`⚠️ EXIF parsing error for ${file.name}:`, exifErr.message); 
        }

        // C. Geocoding (Location details) hasil karein
        const placeDetails = (latitude && longitude) ? await getPlaceDetails(latitude, longitude) : {};

        // D. Tayyar data ko MongoDB mein save karein
        await Image.create({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          imageData: imageBuffer,
          latitude,
          longitude,
          timestamp,
          uploadedBy: email,
          lastCheckedAt: new Date(),
          ...placeDetails
        });

        processedCount++;
      } catch (fileErr) {
        console.error(`❌ Error processing individual file ${file.name}:`, fileErr.message);
        // Agar ek file fail ho, to process ko rokna nahi, continue karna hai.
      }
    }

    console.log(`🎉 Sync complete. Successfully processed ${processedCount} new images.`);
    // User ko frontend par success message ke saath wapas bhej dein.
    res.redirect(`${process.env.FRONTEND_URL}?sync=completed&count=${processedCount}`);

  } catch (err) {
    console.error('❌ Error during direct sync process:', err.message);
    res.status(500).redirect(`${process.env.FRONTEND_URL}?sync=failed`);
  }
};


// ====================================================================
// SECTION: DATA SERVING & STATS (Inmein koi tabdeeli nahi)
// ====================================================================

/**
 * Saari photos ka metadata (image data ke bina) fetch karta hai.
 */
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().select('-imageData').sort({ createdAt: -1 });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

/**
 * Database ID se ek single image ka binary data (file) serve karta hai.
 */
const getImageDataById = async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image || !image.imageData) {
      return res.status(404).send('Image not found');
    }
    res.set('Content-Type', image.mimeType);
    res.send(image.imageData);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Ek specific user ki saari images fetch karta hai.
 */
const getImagesByUploadedBy = async (req, res) => {
  try {
    const { uploadedBy } = req.params;
    const photos = await Image.find({ uploadedBy }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Yeh functions waise hi rahenge jaise pehle the
const getFirstEmailImage = async (req, res) => { /* ... Aapka pehle wala code ... */ };
const getSecondEmailImage = async (req, res) => { /* ... Aapka pehle wala code ... */ };
const getThirdEmailImage = async (req, res) => { /* ... Aapka pehle wala code ... */ };
const getImageStatsByMonth = async (req, res) => { /* ... Aapka pehle wala code ... */ };
const getImageStatsByYear = async (req, res) => { /* ... Aapka pehle wala code ... */ };
const getImageStatsByDay = async (req, res) => { /* ... Aapka pehle wala code ... */ };

// ====================================================================
// SECTION: EXPORTS
// ====================================================================

module.exports = {
  // Syncing and Processing
  syncImages,
  // processSyncQueue, // <-- Isay hata diya gaya hai

  // Data Serving
  getPhotos,
  getImageDataById,
  getImagesByUploadedBy,

  // Specific Email Endpoints
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,

  // Stats
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
};
