// Annie Huynh - 261182881 Nicholas Imperioli - 261120345
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { register, login, logout } = require("../controllers/authController");

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // max 20 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts, please try again later." },
});

router.post("/register", authLimiter, register);
router.post("/login",    authLimiter, login);
router.post("/logout", logout);

module.exports = router;