// config/db.js

const mongoose = require('mongoose');

// Connection state ko track karne ke liye variable
let isConnected = false;

const connectDB = async () => {
  // Agar pehle se connected hai to dobara connect na karein
  if (isConnected) {
    console.log('MongoDB is already connected.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Yeh options connection ko behtar banate hain
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Process ko exit na karein, balki error throw karein taaki Vercel logs mein nazar aaye
    throw new Error('Database connection failed');
  }
};

module.exports = connectDB;
