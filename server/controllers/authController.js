const User = require('../models/User');
const jwt = require('jsonwebtoken');
// Removed nodemailer since email verification is not needed anymore

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Signup now marks the user as verified by default
exports.signup = async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    // Set isVerified to true automatically
    const newUser = new User({ email, username, password, isVerified: true, profileInfo: { language: "en" } });
    await newUser.save();
    res.status(201).json({ message: "Signup successful." });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Error signing up." });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password." });
  }
  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });
    user.comparePassword(password, (err, isMatch) => {
      if (err || !isMatch) return res.status(401).json({ error: "Invalid credentials." });
      // Removed email verification check since users are now automatically verified
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, userId: user._id, username: user.username });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error logging in." });
  }
};

// Removed email verification functionality entirely
exports.verifyEmail = async (req, res) => {
  res.status(200).send("Email verification is disabled.");
};
