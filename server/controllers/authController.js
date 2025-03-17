// server/controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Signup now marks the user as verified by default
export async function signup(req, res) {
  const { email, username, password, confirmPassword } = req.body;
  if (!email || !username || !password || !confirmPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    // Set isVerified to true automatically
    const newUser = new User({
      email,
      username,
      password,
      isVerified: true,
      profileInfo: { language: "en" },
    });
    await newUser.save();
    return res.status(201).json({ message: "Signup successful." });
  } catch (err) {
    // Check for duplicate key error (email already exists)
    if (err.code === 11000) {
      return res.status(400).json({ error: "This email is already in use." });
    }
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Error signing up." });
  }
}

// Updated login function: now requires email and password
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });
    user.comparePassword(password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
      // Removed email verification check since users are now automatically verified
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, userId: user._id, email: user.email });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Error logging in." });
  }
}

// Removed email verification functionality entirely
export async function verifyEmail(req, res) {
  res.status(200).send("Email verification is disabled.");
}
