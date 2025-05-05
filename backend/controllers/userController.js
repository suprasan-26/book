import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import transporter from "../config/nodeMailerConfig.js"; // for node mailer
dotenv.config();

const otpCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }) // OTPs expire after 5 minutes

function oldCalculator(user) {
    let old = "";

    const createdDate = new Date(user.createdAt);
    const currentDate = new Date();

    const totalMonths = (currentDate.getFullYear() - createdDate.getFullYear()) * 12 + (currentDate.getMonth() - createdDate.getMonth());

    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;

    const days = Math.floor((currentDate - createdDate) / (1000 * 60 * 60 * 24));

    if (years >= 1) {
        old = `${years} year${years > 1 ? 's' : ''}`;
    } else if (months >= 1) {
        old = `${months} month${months > 1 ? 's' : ''}`;
    } else {
        old = `${days} day${days > 1 ? 's' : ''}`;
    }
    return old;
}

// @desc Register a user
// @route POST /api/user/register
// @access public
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, language } = req.body;

    if (!name || !email || !password) {
        res.status(400);
        throw new Error("All fields are required");
    }
    const userAvailableEmail = await User.findOne({ email });
    if (userAvailableEmail) {
        res.status(400);
        throw new Error("Email already registered");
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // When you write username and email directly inside the object, it's using object property shorthand, assumes the key and the value are the same.
    const user = await User.create({
        name,
        email,
        password: hashedPassword,
        language
    });

    if (user) {
        res.status(201).json({ _id: user.id, email: user.email });
    } else {
        res.status(400);
        throw new Error("user data not valid");
    }
});

// @desc Login a user
// @route POST /api/user/login
// @access public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400);
        throw new Error("All fields are required");
    }
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
        const accessToken = jwt.sign({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                language: user.language,
                profilePic: user.profilePic,
                favourites: user.favourites,
                createdAt: user.createdAt
            }
        },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: "12h" });

        const old = oldCalculator(user);

        res.status(200).cookie('accessToken', accessToken, {
            httpOnly: true,
            sameSite: process.env.COOKIE_SAME_SITE,
            secure: process.env.COOKIE_SECURE_STATE,
        }).json({ name: user.name, email: user.email, profilePic: user.profilePic, old, favourites: user.favourites });
    } else {
        res.status(400);
        throw new Error("email or password not valid");
    }
});

// @desc Update a user
// @route PUT /api/user/update
// @access private
const updateUser = asyncHandler(async (req, res) => {
    const { name, email, profilePic, language } = req.body;

    // email check
    const emailCheck = await User.findOne({ email });
    if ((emailCheck && emailCheck.id != req.user.id)) {
        res.status(401);
        throw new Error("user not authorized to update data with this email");
    }

    const fetchedUser = await User.findById(req.user.id);
    if (!fetchedUser) {
        res.status(400);
        throw new Error("user not found")
    }

    const data = {
        name,
        email,
        profilePic,
        language
    }

    const updated = await User.findByIdAndUpdate(req.user.id, data, { new: true });

    const accessToken = jwt.sign({
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            language: updated.language,
            profilePic: updated.profilePic,
            favourites: updated.favourites,
            createdAt: updated.createdAt
        }
    },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "12h" });
    res.status(200).cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE,
        secure: process.env.COOKIE_SECURE_STATE,
    }).json({
        name: updated.name,
        email: updated.email,
        language: updated.language
    });
});

// @desc Current user information
// @route GET /api/user/current
// @access private
const currentUser = asyncHandler(async (req, res) => {
    const old = oldCalculator(req.user);
    res.status(200).json({ ...req.user, old });
});

// @desc Logout a user
// @route POST /api/user/logout
// @access private
const logoutUser = asyncHandler(async (req, res) => {
    res.status(200).cookie('accessToken', '', {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE,
        secure: process.env.COOKIE_SECURE_STATE,
    }).json({ message: "logout successful" });
});

// @desc set profile picture for a user
// @route POST /api/user/set-profile-pic
// @access private
const setProfilePic = asyncHandler(async (req, res) => {
    const { profileUrl } = req.body;
    const updated = await User.findByIdAndUpdate(req.user.id, { profilePic: profileUrl }, { new: true });

    if (!updated) {
        res.status(400);
        throw new Error("user not found")
    }

    const accessToken = jwt.sign({
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            language: updated.language,
            profilePic: updated.profilePic,
            favourites: updated.favourites,
            createdAt: updated.createdAt
        }
    },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "12h" });
    res.status(200).cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE,
        secure: process.env.COOKIE_SECURE_STATE,
    }).json({
        img: profileUrl
    });
});

// @desc add place to favourites of user
// @route POST /api/user/add-to-favourites
// @access private
const addToFavourites = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        res.status(400);
        throw new Error("Place ID is required");
    }

    const updated = await User.findByIdAndUpdate(
        req.user.id,
        { $addToSet: { favourites: id } }, // Add to favourites array if not already present
        { new: true }
    );

    if (!updated) {
        res.status(404);
        throw new Error("User not found");
    }

    const accessToken = jwt.sign({
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            language: updated.language,
            profilePic: updated.profilePic,
            favourites: updated.favourites,
            createdAt: updated.createdAt
        }
    },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "12h" });
    res.status(200).cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE,
        secure: process.env.COOKIE_SECURE_STATE,
    }).json({
        favourites: updated.favourites,
    });
});

// @desc remove place from favourites of user
// @route POST /api/user/remove-from-favourites
// @access private
const removeFromFavourites = asyncHandler(async (req, res) => {
    const { id } = req.body;

    if (!id) {
        res.status(400);
        throw new Error("Place ID is required");
    }

    const updated = await User.findByIdAndUpdate(
        req.user.id,
        { $pull: { favourites: id } }, // Remove the place ID from favourites
        { new: true }
    );

    if (!updated) {
        res.status(404);
        throw new Error("User not found");
    }

    const accessToken = jwt.sign({
        user: {
            id: updated.id,
            name: updated.name,
            email: updated.email,
            language: updated.language,
            profilePic: updated.profilePic,
            favourites: updated.favourites,
            createdAt: updated.createdAt
        }
    },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "12h" });
    res.status(200).cookie('accessToken', accessToken, {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAME_SITE,
        secure: process.env.COOKIE_SECURE_STATE,
    }).json({
        favourites: updated.favourites,
    });
});

// @desc get favourites of user
// @route GET /api/user/favourites
// @access private
const getFavourites = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("favourites").populate("favourites");
    if (!user) {
        res.status(404);
        throw new Error("User not found");
    }
    res.status(200).json(user.favourites)
});

// @desc change password of user by verifying current password
// @route POST /api/user/change-pass
// @access private
const changePass = asyncHandler(async (req, res) => {
    const { curPass, newPass } = req.body;

    const user = await User.findById(req.user.id).select("password");

    const curPassValid = await bcrypt.compare(curPass, user.password);
    if (curPassValid) {
        const hashedPassword = await bcrypt.hash(newPass, 10);
        await User.findByIdAndUpdate(req.user.id, { password: hashedPassword });
        res.status(200).json({ message: "password changed successfully" })
    } else {
        res.status(400);
        throw new Error("current password is incorrect");
    }
});

// @desc change password of user after OTP verification
// @route POST /api/user/change-pass
// @access private
const changePassOtpVerified = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
        res.status(400);
        throw new Error("No user found with the entered email ID");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findByIdAndUpdate(user.id, { password: hashedPassword });
    res.status(200).json({ message: "password changed successfully" })
});

// @desc send OTP to mail for verification
// @route POST /api/user/send-otp
// @access private
const sendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error("Email is required");
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const hashedOtp = await bcrypt.hash(otp, 10);

    otpCache.set(email, hashedOtp)  // storing in cache

    const mailOptions = {
        from: `"StayEase by Suprasan" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "OTP for verification",
        text: `Your OTP is: ${otp}. It is valid for 5 minutes`
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        res.status(500);
        throw new Error("Error sending email");
    }
});

// @desc to verify entered OTP is correct
// @route POST /api/user/verify-otp
// @access private
const verifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        res.status(400);
        throw new Error("All fields are required");
    }

    const storedOtp = otpCache.get(email);

    // Check if OTP is expired
    if (!storedOtp) {
        res.status(404);
        throw new Error("OTP not found or expired");
    }

    // Compare the provided OTP with the stored OTP
    const isOtpValid = await bcrypt.compare(otp, storedOtp);

    if (isOtpValid) {
        otpCache.del(email);  // OTP is valid, remove it from cache
        res.status(200).json({ message: "OTP verified successfully" });
    } else {
        res.status(400);
        throw new Error("Invalid OTP");
    }
});

// @desc Get user data by id
// @route GET /api/user/:id
// @access public
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(400);
        throw new Error("User not found");
    }

    let old = oldCalculator(user)

    res.json({ name: user.name, email: user.email, old, id: user.id, profilePic: user.profilePic }).status(200);
});

export { registerUser, loginUser, updateUser, currentUser, logoutUser, getUserById, setProfilePic, addToFavourites, removeFromFavourites, getFavourites, changePass, changePassOtpVerified, sendOtp, verifyOtp }