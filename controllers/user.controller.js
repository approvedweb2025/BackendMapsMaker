const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt =jsonwebtoken');

/**
 * @desc    Register a new user
 * @route   POST /users/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password.' });
  }

  try {
    // Check if user already exists with the same email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    // Check if user already exists with the same username
    const existingUserByName = await User.findOne({ name });
    if (existingUserByName) {
      return res.status(400).json({ message: 'This username is already taken. Please choose another one.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if this is the first user. If so, make them an admin.
    const userCount = await User.countDocuments();
    let newUser;

    if (userCount === 0) {
      // Create the first user as an admin with approved status
      newUser = await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        statusaccess: 'approved',
      });
    } else {
      // Create a regular user with pending status
      newUser = await User.create({
        name,
        email,
        password: hashedPassword,
        permissions: ['Dashboard', 'MyInfo'] // Default permissions
      });
    }

    // Don't send password back
    const { password: _, ...userToReturn } = newUser.toObject();

    res.status(201).json({ message: 'User registered successfully. Waiting for admin approval.', user: userToReturn });

  } catch (error) {
    console.error('Register User Error:', error);
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

/**
 * @desc    Login a user
 * @route   POST /users/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).json({ message: 'Please provide username and password.' });
  }

  try {
    // Find user by username
    const user = await User.findOne({ name });
    if (!user) {
      return res.status(400).json({ message: 'Incorrect username or password.' });
    }

    // Check user status before allowing login
    if (user.role === 'user') {
      if (user.statusaccess === 'denied') {
        return res.status(403).json({ message: 'Your account access has been denied by the admin.' });
      }
      if (user.statusaccess === 'pending') {
        return res.status(403).json({ message: 'Your account is pending approval from the admin.' });
      }
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect username or password.' });
    }

    // Create JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Remove password from the user object before sending response
    const { password: _, ...userData } = user.toObject();

    // Set token in an HTTP-Only cookie for security
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      message: 'Login successful',
      user: userData,
      token: token
    });

  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

/**
 * @desc    Logout a user
 * @route   POST /users/logout
 * @access  Public
 */
const logoutUser = (req, res) => {
  try {
    // Clear the token cookie
    res.clearCookie('token', {
      httpOnly: true,
      sameSite: 'Strict',
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(200).json({ message: 'Logout successful.' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Server error during logout.', error: error.message });
  }
};

/**
 * @desc    Get current logged-in user's details
 * @route   GET /users/me
 * @access  Private
 */
const me = (req, res) => {
  // The user object is attached to req by the authMiddleware
  res.status(200).json({ user: req.user });
};

/**
 * @desc    Update user details (username, password)
 * @route   PUT /users/user/:id
 * @access  Private (User can update their own info)
 */
const updateUserDetails = async (req, res) => {
  try {
    const { username, password } = req.body;
    const { id } = req.params;

    if (!username) {
      return res.status(400).json({ message: 'Username is required.' });
    }

    // Check if the new username is already taken by another user
    const existingUser = await User.findOne({ name: username });
    if (existingUser && existingUser._id.toString() !== id) {
      return res.status(409).json({ message: 'Username already exists.' });
    }

    const updateData = { name: username };

    // If a new password is provided, hash it and add to update data
    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ message: 'User updated successfully.', user: updatedUser });
  } catch (err) {
    console.error('❌ Update User Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// --- Admin Only Functions ---

/**
 * @desc    Get all non-admin users
 * @route   GET /users
 * @access  Admin
 */
const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('-password');
    res.status(200).json(users);
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({ message: 'Server error while fetching users.', error: error.message });
  }
};

/**
 * @desc    Get users with 'pending' status
 * @route   GET /users/getrequest
 * @access  Admin
 */
const getrequest = async (req, res) => {
  try {
    const requests = await User.find({ statusaccess: 'pending', role: { $ne: 'admin' } }).select('-password');
    res.status(200).json({ requests });
  } catch (err) {
    console.error('Get Pending Requests Error:', err);
    res.status(500).json({ message: 'Error fetching pending requests.', error: err.message });
  }
};

/**
 * @desc    Get users with 'denied' status
 * @route   GET /users/denied-request
 * @access  Admin
 */
const getdeniedrequest = async (req, res) => {
  try {
    const requests = await User.find({ statusaccess: 'denied', role: { $ne: 'admin' } }).select('-password');
    res.status(200).json({ requests });
  } catch (err) {
    console.error('Get Denied Requests Error:', err);
    res.status(500).json({ message: 'Error fetching denied requests.', error: err.message });
  }
};

/**
 * @desc    Get users with 'approved' status
 * @route   GET /users/approved-request
 * @access  Admin
 */
const getapprovedrequest = async (req, res) => {
  try {
    const requests = await User.find({ statusaccess: 'approved', role: { $ne: 'admin' } }).select('-password');
    res.status(200).json({ requests });
  } catch (err) {
    console.error('Get Approved Requests Error:', err);
    res.status(500).json({ message: 'Error fetching approved requests.', error: err.message });
  }
};

/**
 * @desc    Approve or deny a user's access
 * @route   POST /users/status
 * @access  Admin
 */
const allowUser = async (req, res) => {
  try {
    const { Id, status } = req.body;
    if (!Id || !status || !['approved', 'denied'].includes(status)) {
        return res.status(400).json({ message: 'User ID and a valid status are required.' });
    }

    const user = await User.findByIdAndUpdate(Id, { statusaccess: status }, { new: true });

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ message: `User status successfully updated to ${status}.` });
  } catch (err) {
    console.error('Allow User Error:', err);
    res.status(500).json({ message: 'User status could not be updated.', error: err.message });
  }
};

/**
 * @desc    Add a new user by an admin
 * @route   POST /users/userbyadmin
 * @access  Admin
 */
const addUser = async (req, res) => {
    // This function is very similar to registerUser, but for admin use.
    // It can be refactored, but for now, it's kept as is from your code.
    const { name, email, password, statusaccess } = req.body;

    if (!name || !email || !password || !statusaccess) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    
    try {
        const existingUser = await User.findOne({ $or: [{ email }, { name }] });
        if (existingUser) {
            return res.status(409).json({ message: 'A user with this email or username already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await User.create({
            name,
            email,
            password: hashedPassword,
            statusaccess,
            permissions: ['Dashboard', 'MyInfo']
        });

        res.status(201).json({ message: 'User created successfully by admin.' });

    } catch (err) {
        console.error('Add User by Admin Error:', err);
        res.status(500).json({ message: 'Server error while creating user.', error: err.message });
    }
};

/**
 * @desc    Delete a user
 * @route   DELETE /users/delete/:id
 * @access  Admin
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
        return res.status(404).json({ message: 'User not found.' });
    }
    res.status(200).json({ message: 'User deleted successfully.' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ message: 'Failed to delete user.', error: err.message });
  }
};

/**
 * @desc    Update a user's page permissions
 * @route   POST /users/give-access/:username
 * @access  Admin
 */
const userAccess = async (req, res) => {
  const { username } = req.params;
  const { pages } = req.body; // Expecting pages to be an array of strings

  if (!Array.isArray(pages)) {
    return res.status(400).json({ message: 'Permissions must be provided as an array.' });
  }

  try {
    const updatedUser = await User.findOneAndUpdate(
      { name: username },
      { $set: { permissions: pages } },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({ message: 'Permissions updated successfully.', user: updatedUser });
  } catch (err) {
    console.error('Update Permissions Error:', err);
    res.status(500).json({ message: 'Failed to update user permissions.' });
  }
};

/**
 * @desc    Check a user's permissions
 * @route   POST /users/permissions/:username
 * @access  Admin
 */
const checkPermissions = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ name: username });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    // Filter out default permissions if needed, as in your original code
    const filteredPermissions = (user.permissions || []).filter(
      (perm) => perm !== 'Dashboard' && perm !== 'MyInfo'
    );

    res.status(200).json({
      message: 'Permissions fetched successfully.',
      permissions: filteredPermissions,
    });

  } catch (err) {
    console.error('Check Permissions Error:', err);
    res.status(500).json({ message: "Failed to fetch permissions." });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getUsers,
  getrequest,
  getapprovedrequest,
  getdeniedrequest,
  allowUser,
  deleteUser,
  userAccess,
  checkPermissions,
  me,
  addUser,
  updateUserDetails,
};
