// Annie Huynh - 261182881
const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");

router.post("/register", register); //maps register function
router.post("/login", login); //maps login function

module.exports = router;