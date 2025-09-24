// config/db.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

mongoose.set("strictQuery", false);

let isConnected = null; // cache connection across function calls

const connectDB = async () => {
  if (isConnected) {
    // Already connected, reuse it
    return;
  }

  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("❌ MONGO_URI is not set in environment.");
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      retryWrites: true,
    });

    isConnected = conn.connections[0].readyState;
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message || error);
    throw error; // don’t exit, just throw
  }
};

module.exports = connectDB;
