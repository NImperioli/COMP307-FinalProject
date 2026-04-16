// William Borlase 261143451
// ref: https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs


const jwt = require('jsonwebtoken');

exports.authenticateOwnerToken = async (req, res, next) => {
    // Note: Invalid for Owner
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];

    if (token){
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err){
                // Invalid!
                return res.status(403).json({message: "Invalid Token!"});
            }
            req.user = decoded;
            if (req.user.role !== "owner"){
                // unauthorized role.
                return res.status(403).json({message: "Unauthorized access"});
            }
            next();
        });
    }
    else {
        // no authorization JW token
        return res.status(401).json({message: "Auth Token not Found!"});
    }
}

exports.authenticateUserToken = async (req, res, next) => {
    // Note: Invalid for Owner
    const header = req.headers['authorization'];
    const token = header && header.split(' ')[1];

    if (token){
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err){
                // Invalid!
                return res.status(403).json({message: "Invalid Token!"});
            }
            req.user = decoded;
            if (req.user.role !== "user"){
                // unauthorized role.
                return res.status(403).json({message: "Unauthorized access"});
            }
            next();
        });
    }
    else {
        // no authorization JW token
        return res.status(401).json({message: "Auth Token not Found!"});
    }
}