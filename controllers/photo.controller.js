const axios = require("axios");
const exifr = require("exifr");
const mongoose = require("mongoose");
const Image = require("../models/Image.model");
const { uploadBufferToGridFS, openDownloadStreamById } = require("../config/gridfs");
const cloudinary = require("cloudinary").v2;

// ✅ Configure Cloudinary
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ✅ Upload buffer to Cloudinary with ONLY 3 folders
const uploadBufferToCloudinary = async (buffer, filename, uploadedBy = "anonymous") => {
  if (!cloudinary.config().cloud_name) return null;

  const folderMap = {
    "mhuzaifa8519@gmail.com": "first-email",
    "mhuzaifa86797@gmail.com": "second-email",
    "muhammadjig8@gmail.com": "third-email",
  };

  const folderName = folderMap[uploadedBy];
  if (!folderName) throw new Error("❌ Unknown uploader email — must match one of the defined users.");

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: `maps-maker/${folderName}`,
        public_id: `${folderName}_${Date.now()}_${filename}`,
        resource_type: "image",
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    upload.end(buffer);
  });
};

// ✅ Reverse Geocoding via Google API
const getPlaceDetails = async (lat, lng) => {
  try {
    const res = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { latlng: `${lat},${lng}`, key: process.env.GOOGLE_GEOCODING_API_KEY },
    });

    if (res.data.status === "OK" && res.data.results.length > 0) {
      const components = res.data.results[0].address_components;
      const extract = (type) => components.find((c) => c.types.includes(type))?.long_name || "";

      return {
        district: extract("administrative_area_level_2") || extract("administrative_area_level_1") || "",
        tehsil: extract("administrative_area_level_3") || extract("sublocality_level_1") || "",
        village: extract("locality") || extract("sublocality") || extract("neighborhood") || "",
        country: extract("country") || "",
      };
    }
    return { district: "", tehsil: "", village: "", country: "" };
  } catch (err) {
    console.error("❌ Geocode error:", err.message);
    return { district: "", tehsil: "", village: "", country: "" };
  }
};

// ✅ Upload single image (Cloudinary + GridFS + DB)
const uploadPhoto = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({ error: "Database not connected" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Extract EXIF
    let latitude = null,
      longitude = null,
      timestamp = new Date();
    try {
      if (["image/jpeg", "image/jpg", "image/tiff"].includes(mimeType)) {
        const exifData = await exifr.parse(fileBuffer);
        if (exifData) {
          if (exifData.latitude && exifData.longitude) {
            latitude = exifData.latitude;
            longitude = exifData.longitude;
          }
          if (exifData.DateTimeOriginal) timestamp = new Date(exifData.DateTimeOriginal);
        }
      }
    } catch (err) {
      console.warn("⚠️ EXIF parse failed:", err.message);
    }

    let placeDetails = { district: "", tehsil: "", village: "", country: "" };
    if (latitude && longitude) {
      placeDetails = await getPlaceDetails(latitude, longitude);
    }

    // Upload to Cloudinary (strict 3-folder mapping)
    let cloudResult = null;
    try {
      cloudResult = await uploadBufferToCloudinary(
        fileBuffer,
        originalName,
        req.user?.email || "anonymous"
      );
    } catch (e) {
      console.warn("⚠️ Cloudinary upload failed:", e?.message || e);
    }

    // Upload binary to GridFS
    let fileId = null;
    try {
      fileId = await uploadBufferToGridFS({
        filename: originalName,
        contentType: mimeType,
        buffer: fileBuffer,
        metadata: { uploadedBy: req.user?.email || "anonymous" },
      });
    } catch (e) {
      console.warn("⚠️ GridFS upload failed:", e?.message || e);
    }

    const doc = await Image.create({
      fileId: fileId ? String(fileId) : undefined,
      name: originalName,
      mimeType,
      latitude,
      longitude,
      uploadedBy: req.user?.email || "anonymous",
      timestamp,
      lastCheckedAt: new Date(),
      cloudinaryUrl: cloudResult?.secure_url || null,
      ...placeDetails,
    });

    res.status(201).json({ message: "Uploaded", photo: doc });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Failed to upload image", details: err.message });
  }
};

// ✅ Stream image by ID (GridFS)
const streamPhoto = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1)
      return res.status(503).json({ error: "Database not connected" });

    const { id } = req.params;
    let objectId;

    try {
      objectId = new mongoose.Types.ObjectId(id);
    } catch (_) {
      const record = await Image.findOne({ fileId: id });
      if (!record) return res.status(404).json({ error: "Image not found" });
      objectId = new mongoose.Types.ObjectId(record.fileId);
    }

    const imageDoc = await Image.findOne({
      $or: [{ fileId: id }, { fileId: String(objectId) }],
    });
    const contentType = imageDoc?.mimeType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    const readStream = openDownloadStreamById(objectId);
    readStream.on("error", (e) => {
      console.error("GridFS read error:", e?.message);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } catch (err) {
    console.error("❌ Stream error:", err);
    res.status(500).json({ error: "Failed to stream image" });
  }
};

// ✅ Fetch Cloudinary images from a given folder
const getImagesFromCloudinaryFolder = async (folderName) => {
  if (!cloudinary.config().cloud_name) return [];
  try {
    const result = await cloudinary.search
      .expression(`folder:maps-maker/${folderName}`)
      .max_results(500)
      .sort_by("created_at", "desc")
      .execute();

    return result.resources.map((r) => ({
      fileId: r.public_id,
      cloudinaryUrl: r.secure_url,
      name: r.public_id.split("/").pop(),
      timestamp: new Date(r.created_at),
    }));
  } catch (err) {
    console.error(`❌ Failed fetching Cloudinary folder ${folderName}:`, err.message);
    return [];
  }
};

// ✅ 3 specific fetchers
const getFirstEmailImage = async (_, res) => {
  const photos = await getImagesFromCloudinaryFolder("first-email");
  res.status(200).json({ photos });
};

const getSecondEmailImage = async (_, res) => {
  const photos = await getImagesFromCloudinaryFolder("second-email");
  res.status(200).json({ photos });
};

const getThirdEmailImage = async (_, res) => {
  const photos = await getImagesFromCloudinaryFolder("third-email");
  res.status(200).json({ photos });
};

// ✅ Stats & Helper endpoints
const getPhotos = async (req, res) => {
  try {
    const photos = await Image.find().sort({ createdAt: -1 });
    res.status(200).json({ photos });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
};

const getImageStatsByMonth = async (req, res) => {
  try {
    const stats = await Image.aggregate([
      {
        $group: {
          _id: {
            month: { $dateToString: { format: "%Y-%m", date: "$timestamp" } },
            uploadedBy: "$uploadedBy",
          },
          count: { $sum: 1 },
        },
      },
      { $project: { month: "$_id.month", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { month: 1 } },
    ]);
    res.status(200).json({ stats });
  } catch (err) {
    res.status(500).json({ error: "Failed monthly stats" });
  }
};

const getImageStatsByDay = async (req, res) => {
  try {
    const stats = await Image.aggregate([
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            uploadedBy: "$uploadedBy",
          },
          count: { $sum: 1 },
        },
      },
      { $project: { date: "$_id.date", uploadedBy: "$_id.uploadedBy", count: 1, _id: 0 } },
      { $sort: { date: 1 } },
    ]);
    res.status(200).json({ stats });
  } catch (err) {
    res.status(500).json({ error: "Failed daily stats" });
  }
};

// ✅ Export all
module.exports = {
  uploadPhoto,
  streamPhoto,
  getPhotos,
  getImageStatsByMonth,
  getImageStatsByDay,
  getFirstEmailImage,
  getSecondEmailImage,
  getThirdEmailImage,
};
