// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { catchAsync, AppError } = require('../utils/errorHandler'); // Helper utility

// ✅ Protects routes that require a logged-in user
const protect = catchAsync(async (req, res, next) => {
  let token;

  // 1) Cookie se token nikalna
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // Agar authorization header se token bheja gaya ho (optional fallback)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token || token === 'loggedout') {
    return next(new AppError('You are not logged in. Please log in to get access.', 401));
  }

  // 2) Token ko verify karna
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 3) Check karna ki user abhi bhi exist karta hai ya nahi
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(new AppError('The user belonging to this token no longer exists.', 401));
  }

  // NOTE: Agar aap password change par user ko logout karwana chahte hain, to yahan check add kar sakte hain.

  // 4) User ko request object mein attach karna
  req.user = currentUser;
  next(); // Agle middleware ya controller par jaana
});


// ✅ Protects routes that are only for admins
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return next(new AppError('You do not have permission to perform this action.', 403));
  }
};

module.exports = { protect, adminOnly };
