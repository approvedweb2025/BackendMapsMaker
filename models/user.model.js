// models/user.model.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
      type: String,
      required: [true, 'Please enter a name'],
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please enter an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please enter a password'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
   statusaccess:  {
      type: String,
      enum: ['approved', 'denied', 'pending'],
      default: 'pending',
    },
    permissions: [String], // Example: ['Dashboard', 'MyInfo']  
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
