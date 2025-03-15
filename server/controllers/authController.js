const User = require('../models/User');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";
const EMAIL_FROM = process.env.EMAIL_FROM || "no-reply@example.com";

// Setup nodemailer transporter (configure your SMTP settings)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.signup = async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  if (!username || !password || !confirmPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    const newUser = new User({ email, username, password, profileInfo: { language: "en" } });
    await newUser.save();
    // Create a verification token
    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: "1d" });
    const verificationLink = `${req.protocol}://${req.get("host")}/auth/verify/${token}`;
    // Send verification email
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email",
      text: `Please verify your email by clicking the following link: ${verificationLink}`
    });
    res.status(201).json({ message: "Signup successful. Please verify your email." });
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
      if (!user.isVerified) return res.status(403).json({ error: "Please verify your email." });
      // Create JWT token
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, userId: user._id, username: user.username });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error logging in." });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token } = req.params;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).send("User not found.");
    user.isVerified = true;
    await user.save();
    res.send("Email successfully verified. You can now log in.");
  } catch (err) {
    console.error("Email verification error:", err);
    res.status(400).send("Invalid or expired token.");
  }
};
