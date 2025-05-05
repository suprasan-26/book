import express from 'express'
import validateToken from '../middleware/validateTokenhandler.js'
import { registerUser, loginUser, currentUser, logoutUser, getUserById, updateUser, setProfilePic, addToFavourites, removeFromFavourites, getFavourites, sendOtp, verifyOtp, changePass, changePassOtpVerified } from '../controllers/userController.js'

const router = express.Router();

router.route("/set-profile-pic").post(validateToken, setProfilePic);

router.route("/favourites").get(validateToken, getFavourites);
router.route("/add-to-favourites").post(validateToken, addToFavourites);
router.route("/remove-from-favourites").post(validateToken, removeFromFavourites);

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/current").get(validateToken, currentUser);
router.route("/logout").post(validateToken, logoutUser);
router.route("/:id").get(getUserById);
router.route("/update").put(validateToken, updateUser);

router.route("/change-pass").post(validateToken, changePass);
router.route("/change-pass-otp-verified").post(changePassOtpVerified);

router.route("/send-otp").post(sendOtp);
router.route("/verify-otp").post(verifyOtp);

export default router;