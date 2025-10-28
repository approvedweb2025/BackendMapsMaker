// config/db.js
const mongoose = require('mongoose');

// Connection state ko track karein taaki baar-baar connect na ho
let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log('MongoDB is already connected.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Error throw karein taaki logs mein nazar aaye
    throw new Error('Database connection failed');
  }
};

module.exports = connectDB;
