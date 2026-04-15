// Annie Huynh - 261182881
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getDB } = require("../config/db");
const { getRoleFromEmail } = require("../models/userModel");

const COLLECTION = "users";

const register = async (req, res) => {
  const { email, name, password } = req.body;

  try {
    // Validate email domain
    const role = getRoleFromEmail(email);
    if (!role) {
      return res.status(400).json({ error: "Only @mcgill.ca or @mail.mcgill.ca emails can register." });
    }

    const db = getDB();

    // Check if email already exists
    const existing = await db.collection(COLLECTION).findOne({ email });
    if (existing) {
      return res.status(400).json({ error: "Email already registered." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert the new user
    await db.collection(COLLECTION).insertOne({
      email,
      name,
      password: hashedPassword,
      role,
      createdAt: new Date()
    });

    res.status(201).json({ message: "User registered successfully." });

  } catch (err) {
    res.status(500).json({ error: err.message });
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
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, role: user.role, name: user.name, id: user._id.toString(), email:user.email });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login };