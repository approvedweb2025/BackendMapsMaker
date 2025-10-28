// config/db.js
const mongoose = require('mongoose');
const { initGridFS } = require('./gridfs'); // Ensure this path is correct

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error(
    'Please define the MONGO_URI environment variable inside .env.local or in Vercel settings'
  );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 * In a serverless environment, this caches the connection between function invocations.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  // If we have a cached connection, reuse it
  if (cached.conn) {
    console.log('✅ Using cached MongoDB connection.');
    return cached.conn;
  }

  // If there's no cached promise, create a new connection promise
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Recommended for serverless
      serverSelectionTimeoutMS: 10000, // 10 second timeout
    };

    console.log('⚡ Creating new MongoDB connection...');
    cached.promise = mongoose.connect(MONGO_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    });
  }

  try {
    // Await the promise to get the connection instance
    cached.conn = await cached.promise;
    console.log(`✅ MongoDB Connected: ${cached.conn.connection.host}`);
    
    // 🆕 Initialize GridFS right after the connection is established
    initGridFS();

    return cached.conn;
  } catch (e) {
    // If the connection fails, reset the cached promise and throw the error
    cached.promise = null;
    console.error('❌ MongoDB connection error:', e);
    throw new Error('Failed to connect to the database.');
  }
}

module.exports = connectDB;
