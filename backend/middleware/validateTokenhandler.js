import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";

const validateToken = asyncHandler(async (req, res, next) => {
    let token = req.cookies.accessToken;

    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                res.status(401);
                throw new Error("user is not authorized");
            }
            req.user = decoded.user;
            next();
        });
    } else {
        res.status(401);
        req.user = {error: "login failed"}
        throw new Error("No user is logged in");
    }
});

export default validateToken;