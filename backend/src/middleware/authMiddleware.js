// William Borlase 261143451 - Nicholas Imperioli 261120345
// ref: https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs

//TODO: Errors may not be properly handled. Something like this? https://www.geeksforgeeks.org/node-js/how-to-return-an-error-back-to-expressjs-from-middleware/

const jwt = require('jsonwebtoken');
const { getDB } = require('../config/db');

const authenticate = async (req, res, next, rolePredicate) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ message: "Auth Token not Found!" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: "Invalid Token!" });
  }

  if (!rolePredicate(decoded.role)) {
    return res.status(403).json({ message: "Unauthorized access" });
  }

  try {
    const db = getDB();
    const blocked = await db.collection("invalidated_tokens").findOne({ jti: decoded.jti });
    if (blocked) return res.status(401).json({ message: "Token has been invalidated." });
  } catch (err) {
    return res.status(500).json({ message: "Auth check failed." });
  }

  req.user = decoded;
  next();
};

exports.authenticateOwnerToken = (req, res, next) => {
  authenticate(req, res, next, role => role === "owner");
};

exports.authenticateUserToken = (req, res, next) => {
  authenticate(req, res, next, role => role === "owner" || role === "student");
};

exports.authenticateAnyToken = (req, res, next) => {
  authenticate(req, res, next, () => true);
};