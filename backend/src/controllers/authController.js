// Annie Huynh - 261182881
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { getRoleFromEmail } = require("../models/userModel");
const { createUser } = require("../models/userModel");
const crypto = require("crypto");

const COLLECTION = "users";

// Create a new route: POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const header = req.headers["authorization"];
    const token = header && header.split(" ")[1];
    if (!token) return res.status(400).json({ error: "No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();

    // Store the jti until the token would naturally expire
    await db.collection("invalidated_tokens").insertOne({
      jti: decoded.jti,
      expiresAt: new Date(decoded.exp * 1000),  // TTL index on this field
    });

    res.json({ message: "Logged out successfully." });
  } catch (err) {
    res.status(400).json({ error: "Invalid token." });
  }
};

const register = async (req, res) => {
  const { email, name, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // createUser handles domain validation and duplicate check internally
    await createUser({ email, name, password: hashedPassword });
    res.status(201).json({ message: "User registered successfully." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = getDB();

    // Find user
    const user = await db.collection(COLLECTION).findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },  // ADDED: email
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: user.role, name: user.name, id: user._id.toString(), email:user.email });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, logout };