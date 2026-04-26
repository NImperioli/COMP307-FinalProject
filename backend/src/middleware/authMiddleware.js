// William Borlase 261143451 - Nicholas Imperioli 261120345
// ref: https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs

//TODO: Errors may not be properly handled. Something like this? https://www.geeksforgeeks.org/node-js/how-to-return-an-error-back-to-expressjs-from-middleware/

const jwt = require('jsonwebtoken');


const verify = (token, res, next, rolePredicate) => {
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token!" });
    if (!rolePredicate(decoded.role))
      return res.status(403).json({ message: "Unauthorized access" });
    req.user = decoded;   // decoded contains { id, role, email } 
    next();
  });
};

const extractToken = (req, res) => {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: "Auth Token not Found!" });
    return null;
  }
  return token;
};

exports.authenticateOwnerToken = (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token!" });
    if (decoded.role !== "owner") return res.status(403).json({ message: "Unauthorized access" });
    req.user = decoded;
    next();
  });
};

exports.authenticateUserToken = (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token!" });
    if (decoded.role !== "student") return res.status(403).json({ message: "Unauthorized access" });
    req.user = decoded;
    next();
  });
};

// NEW: accepts both owners and students
exports.authenticateAnyToken = (req, res, next) => {
  const token = extractToken(req, res);
  if (!token) return;
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Invalid Token!" });
    req.user = decoded;
    next();
  });
};