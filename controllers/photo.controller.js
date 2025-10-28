// controllers/photo.controller.js

const axios = require('axios');
const exifr = require('exifr');
const Image = require('../models/Image.model'); // Yaqeen karein ke model ka path sahi ho

// Google Drive se file ko memory me download karne ka function
const downloadFileToBuffer = async (fileId, accessToken) => {
  const response = await axios.get(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'arraybuffer' // Yeh zaroori hai binary data ke liye
    }
  );
  return Buffer.from(response.data, 'binary');
};

// Latitude/Longitude se jaga ki maloomat haasil karne ka function
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
    return { district: "", tehsil: "", village: "", country: "" };
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return { district: "", tehsil: "", village: "", country: "" };
  }
};

// Google Drive se images ko database me sync karne ka main function
const syncImages = async (req, res) => {
  // Wajahat: Pehle check karein ke user login hai ya nahi.
  if (!req.isAuthenticated() || !req.user) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=unauthorized`);
  }
  const accessToken = req.user.accessToken;
  const userEmail = req.user.email;

  try {
    let files = [];
    let nextPageToken = null;

    console.log(`Starting image sync for user: ${userEmail}`);

    // Jab tak saari images na mil jayein, Google Drive se fetch karte rahein
    do {
      const driveResponse = await axios.get('https://www.googleapis.com/drive/v3/files', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          q: "mimeType contains 'image/' and trashed=false",
          fields: 'nextPageToken, files(id, name, mimeType, createdTime)',
          pageToken: nextPageToken,
          pageSize: 100 // Ek bar me 100 files fetch karein
        }
      });

      if (driveResponse.data.files) {
        files.push(...driveResponse.data.files);
      }
      nextPageToken = driveResponse.data.nextPageToken;
    } while (nextPageToken);

    console.log(`✅ Total files found on Google Drive: ${files.length}`);

    // Har file ko process karein
    for (const file of files) {
      try {
        // Wajahat: Check karein ke yeh image *isi user ke liye* pehle se save to nahi.
        const exists = await Image.findOne({ fileId: file.id, uploadedBy: userEmail });
        if (exists) {
          continue; // Agar hai, to agli file par chale jayein
        }

        const imageBuffer = await downloadFileToBuffer(file.id, accessToken);

        let latitude = null, longitude = null;
        let timestamp = new Date(file.createdTime || Date.now());

        // EXIF data (location, date) nikalne ki koshish karein
        try {
          if (['image/jpeg', 'image/jpg', 'image/tiff'].includes(file.mimeType)) {
            const exifData = await exifr.parse(imageBuffer);
            if (exifData) {
              latitude = exifData.latitude || null;
              longitude = exifData.longitude || null;
              if (exifData.DateTimeOriginal) {
                timestamp = new Date(exifData.DateTimeOriginal);
              }
            }
          }
        } catch (err) {
          console.warn(`⚠️ EXIF error for ${file.name}:`, err.message);
        }

        let placeDetails = { district: "", tehsil: "", village: "", country: "" };
        if (latitude && longitude) {
          placeDetails = await getPlaceDetails(latitude, longitude);
        }

        // Database me naya image document banayein
        await Image.create({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          imageData: imageBuffer,
          latitude,
          longitude,
          timestamp,
          uploadedBy: userEmail,
          lastCheckedAt: new Date(),
          ...placeDetails
        });
      } catch (fileErr) {
        console.error(`❌ Error processing file ${file.name}:`, fileErr.message);
      }
    }

    console.log('✅ Sync complete! Redirecting to dashboard...');
    // Wajahat: Saara kaam khatam hone ke baad, user ko frontend ke dashboard par bhej dein.
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?sync=success`);

  } catch (err) {
    console.error('❌ Sync process failed:', err);
    // Wajahat: Agar sync ke dauran koi bari galti hojaye, to user ko error ke saath wapas bhej dein.
    res.redirect(`${process.env.FRONTEND_URL}/dashboard?error=sync_failed`);
  }
};

// Database se saari photo ki maloomat (bina image data ke) fetch karna
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().select('-imageData').sort({ createdAt: -1 });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
};

// Database ID se image ka اصل binary data fetch karna
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

// Email ke hisaab se images fetch karna
const getImagesByUploadedBy = async (req, res) => {
  try {
    const { uploadedBy } = req.params;
    const photos = await Image.find({ uploadedBy }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
};


// --- Stats ke Functions ---

const getImageStatsByMonth = async (req, res) => {
  try {
    const monthlyStats = await Image.aggregate([
      { $group: { _id: { month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { month: "$_id.month", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { month: 1 } }
    ]);
    const uniqueUploaders = [...new Set(monthlyStats.map((s) => s.uploadedBy).filter(Boolean))];
    res.status(200).json({ stats: monthlyStats, uniqueUploaders });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get monthly stats', error: err.message });
  }
};

const getImageStatsByYear = async (req, res) => {
  try {
    const yearlyStats = await Image.aggregate([
      { $group: { _id: { year: { $dateToString: { format: "%Y", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { year: "$_id.year", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { year: 1 } }
    ]);
    res.status(200).json({ stats: yearlyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get yearly stats', error: err.message });
  }
};

const getImageStatsByDay = async (req, res) => {
  try {
    const dailyStats = await Image.aggregate([
      { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, uploadedBy: "$uploadedBy" }, count: { $sum: 1 } } },
      { $project: { date: "$_id.date", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { date: 1 } }
    ]);
    res.status(200).json({ stats: dailyStats });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get daily stats', error: err.message });
  }
};

// --- Hardcoded Emails ke Functions (jaisa aapne diya tha) ---

const getFirstEmailImage = async (req, res) => {
  try {
    const photos = await Image.find({ uploadedBy: 'mhuzaifa8519@gmail.com' }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images for first email' });
  }
};

const getSecondEmailImage = async (req, res) => {
  try {
    const photos = await Image.find({ uploadedBy: 'mhuzaifa86797@gmail.com' }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images for second email' });
  }
};

const getThirdEmailImage = async (req, res) => {
  try {
    const photos = await Image.find({ uploadedBy: 'muhammadjig8@gmail.com' }).select('-imageData');
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch images for third email' });
  }
};


// Saare functions ko export karein
module.exports = {
  syncImages,
  getPhotos,
  getImageDataById,
  getImagesByUploadedBy,
  getImageStatsByMonth,
  getImageStatsByYear,
  getImageStatsByDay,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage
};
