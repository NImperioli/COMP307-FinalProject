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

    if (!token) {
      return res.status(400).json({ error: "No token provided." });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        ignoreExpiration: true
      });
    } catch (err) {
      return res.status(400).json({ error: "Invalid token." });
    }

    if (!decoded || !decoded.jti) {
      return res.status(400).json({ error: "Token missing jti." });
    }

    const db = getDB();

    await db.collection("invalidated_tokens").insertOne({
      jti: decoded.jti,
      createdAt: new Date()
    });

    res.json({ message: "Logged out successfully." });

  } catch (err) {
    res.status(500).json({ error: err.message });
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

    const user = await db.collection(COLLECTION).findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid email or password." });
    }

    const jti = crypto.randomUUID();

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        email: user.email,
        jti: jti
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      token,
      role: user.role,
      name: user.name,
      id: user._id.toString(),
      email: user.email
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { register, login, logout };