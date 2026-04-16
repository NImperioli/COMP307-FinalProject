// William Borlase 261143451
// ref: https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs

//TODO: Errors may not be properly handled. Something like this? https://www.geeksforgeeks.org/node-js/how-to-return-an-error-back-to-expressjs-from-middleware/

const jwt = require('jsonwebtoken');

exports.authenticateOwnerToken = async (req, res, next) => {
    // Note: Invalid for user
    const header = req.headers.authorization;
    const token = header.split(' ')[1];

    if (token){
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err){
                console.log("some error");
                // Invalid!
                return res.status(403).json({message: "Invalid Token!"});
            }
            req.user = decoded;
            if (req.user.role !== "owner"){
                // unauthorized role.
                console.log("unauth role");
                return res.status(403).json({message: "Unauthorized access"});
            }
            next();
        });
    }
    else {
        // no authorization JW token
        console.log('token not found');
        return res.status(401).json({message: "Auth Token not Found!" + header + token});
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