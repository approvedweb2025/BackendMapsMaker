// config/db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Cache the connection to reuse in serverless environments
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // If already connected, return the cached connection
  if (cached.conn) {
    return cached.conn;
  }

  // If connection is in progress, wait for it
  if (!cached.promise) {
    const opts = {
      bufferCommands: true, // Enable buffering - Mongoose will queue commands until connected
      bufferMaxEntries: 0, // Unlimited buffering (default) - queue all commands
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // Wait up to 10 seconds to select a server
      socketTimeoutMS: 45000, // How long to wait for a socket operation
      connectTimeoutMS: 10000, // How long to wait for initial connection
    };

    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return mongoose;
    }).catch((error) => {
      cached.promise = null;
      console.error(`MongoDB Connection Error: ${error.message}`);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
};

module.exports = connectDB;
