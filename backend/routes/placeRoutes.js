import express from 'express'
import validateToken from '../middleware/validateTokenhandler.js'
import { addAccommodation, bookAccommodation, cancelBooking, deleteAccommodation, getAccommodationById, getAccommodations, getMyAccommodations, getMyBookings, getPlaceRatings, rateAccommodation, searchByName, updateAccommodation } from '../controllers/placeController.js';

const router = express.Router();

// public routes
router.route("/").get(getAccommodations);
router.route("/public/:id").get(getAccommodationById);
router.route("/public/search/:query").get(searchByName);

router.use(validateToken);

// private routes
router.route("/add").post(addAccommodation);
router.route("/delete/:id").post(deleteAccommodation);
router.route("/rating").post(rateAccommodation);
router.route("/get-rating/:id").get(getPlaceRatings);
router.route("/my-places").get(getMyAccommodations);

router.route("/book").post(bookAccommodation);
router.route("/my-bookings").get(getMyBookings);
router.route("/booking/cancel/:id").post(cancelBooking);
router.route("/:id").put(updateAccommodation);

export default router;