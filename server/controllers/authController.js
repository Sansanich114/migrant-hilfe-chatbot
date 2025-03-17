// server/controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Signup now requires only email, password, confirmPassword
export async function signup(req, res) {
  const { email, password, confirmPassword } = req.body;
  if (!email || !password || !confirmPassword) {
    return res.status(400).json({ error: "Missing required fields." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match." });
  }
  try {
    // Check if email is already used
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "This email is already in use." });
    }
    // Create user
    const newUser = new User({
      email,
      password,
      isVerified: true, // automatically verified
      profileInfo: { language: "en" },
    });
    await newUser.save();
    return res.status(201).json({ message: "Signup successful." });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Error signing up." });
  }
}

// Login requires email and password
export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }
  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    // Compare password
    user.comparePassword(password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
      // Generate JWT
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ token, userId: user._id, email: user.email });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Error logging in." });
  }
}

// Removed email verification functionality
export async function verifyEmail(req, res) {
  res.status(200).send("Email verification is disabled.");
}
