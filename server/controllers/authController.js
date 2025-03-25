// authController.js
import User from "../models/User.js";

export async function signup(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }
  try {
    const newUser = new User({
      email,
      password,
      isVerified: true, // Automatically verified
    });
    await newUser.save();
    return res.status(201).json({ message: "Signup successful." });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Error signing up." });
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password." });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials." });

    user.comparePassword(password, (err, isMatch) => {
      if (err || !isMatch) {
        return res.status(401).json({ error: "Invalid credentials." });
      }
      return res.json({ message: "Login successful." });
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Error logging in." });
  }
}
