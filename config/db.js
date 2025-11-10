// config/db.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
  // Reuse connection in serverless environments (e.g., Vercel)
  if (global.mongoose && global.mongoose.conn) {
    return global.mongoose.conn;
  }

  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }

  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set');
    throw new Error('Missing MONGO_URI environment variable');
  }

  if (!global.mongoose.promise) {
    // Configure mongoose once
    mongoose.set('strictQuery', true);
    global.mongoose.promise = mongoose
      .connect(MONGO_URI)
      .then((mongooseInstance) => {
        console.log(`MongoDB Connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      })
      .catch((err) => {
        console.error('Mongo connection error:', err.message);
        throw err;
      });
  }

  global.mongoose.conn = await global.mongoose.promise;
  return global.mongoose.conn;
};

module.exports = connectDB;
