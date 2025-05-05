import asyncHandler from "express-async-handler";
import dotenv from 'dotenv';
import Place from '../models/placeModel.js'
import User from "../models/userModel.js";
import Booking from "../models/bookingModel.js";
import Trie from "../dsa/trie.js";
import mergeInterval from "../dsa/mergeInterval.js";
import transporter from "../config/nodeMailerConfig.js";
import { format } from "date-fns";

dotenv.config();

// search trie initialization
const trie = new Trie();

async function loadTrie() {
    try {
        const places = await Place.find();  // Fetch all places from MongoDB
        places.forEach((place) => {
            trie.insert(place.address.city, place.id);  // Insert each place into the Trie
        });
        console.log('Places loaded into Trie successfully.');
    } catch (error) {
        console.error('Error loading places to Trie:', error);
    }
};

// to filter out photos added by link and from device
// photos uploaded from device would be stored in firebase, this function is used to filter those photos and delete in firebase as well
function getFirebaseLinks(photos){
    let res = [];
    photos.forEach((url) => {
        const list = url.split("/");
        if(list[2] == "firebasestorage.googleapis.com")
            res.push(url);
    });
    return res
}

// @desc Add an accommodation
// @route POST /api/place/add
// @access private
const addAccommodation = asyncHandler(async (req, res) => {
    const { title, address, photos, description, perks, extraInfo, checkIn, checkOut, maxGuests, price } = req.body;

    const placeAvailable = await Place.findOne({ address });
    if (placeAvailable) {
        res.status(400);
        throw new Error("Address already registered");
    }

    const place = await Place.create({
        owner: req.user.id,
        title,
        address,
        photos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
        rating: []
    });

    if (place) {
        trie.insert(place.address.city, place.id);  // Insert place into the Trie
        res.status(201).json({ id: place.id, owner_id: place.owner, message: "success" });
    } else {
        res.status(400)
        throw new Error("Place not added");
    }
});

// @desc Update an accommodation
// @route PUT /api/place/:id
// @access private
const updateAccommodation = asyncHandler(async (req, res) => {
    const data = await Place.findById(req.params.id);
    if (!data) {
        res.status(400);
        throw new Error("Place not found")
    } else if (!data.owner == req.user.id) {
        res.status(400);
        throw new Error("User not authorized to access this place")
    }
    const oldName = data.address.city;

    const updated = await Place.findByIdAndUpdate(req.params.id, req.body, { new: true });
    getFirebaseLinks(updated.photos);
    // trie updataion
    const newName = updated.address.city;
    if (oldName !== newName) {
        trie.delete(oldName, updated.id);
        trie.insert(newName, updated.id);
    }

    res.status(200).json(updated);
});

// @desc delete an accommodation
// @route POST /api/place/delete/:id
// @access private
const deleteAccommodation = asyncHandler(async (req, res) => {
    const data = await Place.findById(req.params.id);
    if (!data) {
        res.status(400);
        throw new Error("Place not found")
    } else if (data.owner != req.user.id) {
        res.status(400);
        throw new Error("User not authorized to delete this place")
    }

    const firebasePhotos = getFirebaseLinks(data.photos);

    const deleted = await Place.findByIdAndDelete(req.params.id);
    if (!deleted) {
        res.status(500); // Internal Server Error in case of unexpected failure
        throw new Error("Failed to delete the place");
    }

    trie.delete(data.address.city, data.id);  // Delete place from the Trie

    res.status(200).json({
        message: "Accommodation deleted successfully",
        photos: firebasePhotos,
    });
});

// @desc Add rating to an accommodation
// @route POST /api/place/rating
// @access private
const rateAccommodation = asyncHandler(async (req, res) => {
    const { id, newRating } = req.body;
    const place = await Place.findById(id, 'rating owner ratedBy');

    if (place.owner == req.user.id) {
        res.status(400);
        throw new Error("You cannot rate your accommodation");
    }

    if (place.ratedBy.includes(req.user.id)) {
        res.status(400);
        throw new Error("You already rated this place")
    }

    let data = { rating: [], ratedBy: [...place.ratedBy, req.user.id] };

    if (!place.rating || place.rating.length === 0) {
        data.rating = [newRating, 1];
    } else {
        const oldRating = Number(place.rating[0]);
        const numberOfRatings = Number(place.rating[1]);

        const currentRating = ((oldRating * numberOfRatings) + Number(newRating)) / (numberOfRatings + 1)
        data.rating = [currentRating.toFixed(1), numberOfRatings + 1];
    }

    const updated = await Place.findByIdAndUpdate(id, data, { new: true })

    res.status(200).json({ rating: updated.rating });
});

// @desc Add rating to an accommodation
// @route POST /api/place/get-rating/:id
// @access private
const getPlaceRatings = asyncHandler(async (req, res) => {
    const ratingData = await Place.findById(req.params.id, 'rating ratedBy');
    res.status(200).json(ratingData)
})

// @desc Get all accommodations added by a user
// @route GET /api/place/my-places
// @access private
const getMyAccommodations = asyncHandler(async (req, res) => {
    const data = await Place.find({ owner: req.user.id });
    if (data)
        res.status(200).json(data);
    else {
        res.status(400);
        throw new Error("Database Error");
    }
});

// @desc Book an accommodation
// @route GET /api/place/book
// @access private
const bookAccommodation = asyncHandler(async (req, res) => {
    const { place, owner, checkIn, checkOut, guests, nights, price } = req.body;

    if (owner == req.user.id) {
        res.status(400);
        throw new Error("You cannot book your own accommodation");
    }

    const bookings = await Booking.find({ place }).sort({ checkIn: 1 });
    let intervals = [];

    for (let book of bookings) {
        intervals.push([new Date(book.checkIn), new Date(book.checkOut)]);
    }

    const canBook = mergeInterval(intervals, [new Date(checkIn), new Date(checkOut)]);

    if (canBook) {
        // fetch place info
        const bookedPlace = await Place.findById(place).select("title address owner").populate("owner");
        const clientData = await User.findById(req.user.id).select("name email");

        // confirmation mail
        const clientMailOptions = {
            from: `"StayEase by Suprasan" <${process.env.EMAIL_USER}>`,
            to: req.user.email,
            subject: "Booking Confirmation - Your Stay is Confirmed!",
            text: `Dear ${req.user.name},

We're excited to confirm your booking at ${bookedPlace.title}!

Booking Details:
- Property: ${bookedPlace.title}, ${bookedPlace.address.city}, ${bookedPlace.address.country}
- Check-in Date: ${format(new Date(checkIn), "dd-MM-yyyy")}
- Check-out Date: ${format(new Date(checkOut), "dd-MM-yyyy")}
- Guests: ${guests}
- Total Amount: ₹ ${price}

Contact details of the host:
Name: ${bookedPlace.owner.name}
Email: ${bookedPlace.owner.email}
Languages known: ${bookedPlace.owner.language}

If you have any questions or need any changes to your booking, feel free to reach out.

We can't wait to host you!

Best regards,
Suprasan Singh`
        };

        const hostMailOptions = {
            from: `"StayEase by suprasan" <${process.env.EMAIL_USER}>`,
            to: bookedPlace.owner.email,
            subject: "Booking Confirmation - Your Property Has Been Booked!",
            text: `
Dear Host,

We are pleased to inform you that your property, "${bookedPlace.title}", has been successfully booked!

Booking Details:
- Property: ${bookedPlace.title}
- Guest Name: ${clientData.name}
- Guest email: ${clientData.email}
- Check-in Date: ${format(new Date(checkIn), "dd-MM-yyyy")}
- Check-out Date: ${format(new Date(checkOut), "dd-MM-yyyy")}
- Total Price: ₹ ${price}

Please ensure that the property is ready for the guest's arrival. If you need any assistance, feel free to reach out to us.

Thank you for hosting on StayEase!

Best regards,
Suprasan Singh
        `
        };

        try {
            await transporter.sendMail(clientMailOptions);
            await transporter.sendMail(hostMailOptions);

            const booking = await Booking.create({
                place,
                client: req.user.id,
                checkIn,
                checkOut,
                guests,
                nights,
                price
            });

            res.status(200).json({ id: booking.id })
        } catch (error) {
            res.status(500);
            throw new Error("Error sending email");
        }

    } else {
        res.status(400).json({ message: "accommodation already booked in these dates" })
    }
});

// @desc cancel a booking
// @route POST /api/place/booking/cancel/:id
// @access private
const cancelBooking = asyncHandler(async (req, res) => {
    const data = await Booking.findById(req.params.id)
        .populate({
            path: 'place',
            select: 'title owner address',
            populate: {
                path: 'owner',
                select: 'name email language'
            }
        })
        .populate({
            path: 'client',
            select: 'name email' // select the client details you need
        });
    if (!data) {
        res.status(400);
        throw new Error("Booking not found")
    } else if (data.client.id != req.user.id) {
        res.status(400);
        throw new Error("User not authorized to cancel this booking")
    }

    // confirmation mail
    const clientMailOptions = {
        from: `"StayEase by Suprasan" <${process.env.EMAIL_USER}>`,
        to: req.user.email,
        subject: "Booking Cancellation - Your Stay has been Cancelled!",
        text: `Dear ${req.user.name},

We would like to confirm that your booking at ${data.place.title} has been successfully cancelled.

Booking Details:
- Property: ${data.place.title}, ${data.place.address.city}, ${data.place.address.country}
- Check-in Date: ${format(new Date(data.checkIn), "dd-MM-yyyy")}
- Check-out Date: ${format(new Date(data.checkOut), "dd-MM-yyyy")}
- Guests: ${data.guests}
- Total Amount: ₹ ${data.price}

If you need further assistance or plan to book again in the future, feel free to contact us.

Best regards,  
Suprasan Singh`
    };

    const hostMailOptions = {
        from: `"StayEase by Suprasan" <${process.env.EMAIL_USER}>`,
        to: data.place.owner.email,
        subject: "Booking Cancellation - Your Property Booking Has Been Cancelled!",
        text: `Dear ${data.place.owner.name},

We are informing you that the booking for your property, "${data.place.title}", has been cancelled by the guest.

Booking Details:
- Property: ${data.place.title}
- Guest Name: ${data.client.name}
- Check-in Date: ${format(new Date(data.checkIn), "dd-MM-yyyy")}
- Check-out Date: ${format(new Date(data.checkOut), "dd-MM-yyyy")}
- Total Price: ₹ ${data.price}

If you have any questions or concerns, please don't hesitate to reach out to us.

Thank you for hosting on StayEase!

Best regards,  
Suprasan Singh`
    };

    try {
        await transporter.sendMail(clientMailOptions);
        await transporter.sendMail(hostMailOptions);

        const cancelled = await Booking.findByIdAndDelete(req.params.id);
        if (!cancelled) {
            res.status(500);
            throw new Error("Failed to delete the place");
        }

        res.status(200).json({
            message: "Booking cancelled successfully",
            cancelled,
        });
    } catch (error) {
        res.status(500);
        throw new Error("Error sending email");
    }
});

// @desc Get all bookings of a user
// @route GET /api/place/my-bookings
// @access private
const getMyBookings = asyncHandler(async (req, res) => {
    const data = await Booking.find({ client: req.user.id }).populate("place", "address id owner title photos ratedBy");
    const past = data.filter(booking => new Date(booking.checkIn) < new Date());
    const upcoming = data.filter(booking => new Date(booking.checkIn) >= new Date());

    if (data)
        res.status(200).json({ past, upcoming });
    else {
        res.status(400);
        throw new Error("Database Error");
    }
});

// @desc Get accommodation by id
// @route GET /api/place/public/:id
// @access public
const getAccommodationById = asyncHandler(async (req, res) => {
    const data = await Place.findById(req.params.id);
    if (!data) {
        res.status(400);
        throw new Error("Place not found")
    }
    res.status(200).json(data);
});

// @desc Get all accommodations
// @route GET /api/place
// @access public
const getAccommodations = asyncHandler(async (req, res) => {
    const data = await Place.find();
    if (data)
        res.json(data).status(200);
    else {
        res.status(400);
        throw new Error("Database Error");
    }
});

// @desc search functionality
// @route GET /api/place/search/searchPrefix
// @access public
const searchByName = asyncHandler(async (req, res) => {
    const { query } = req.params;
    if (!query) return res.json([]);

    const placeIds = trie.search(query);
    const places = await Place.find({ _id: { $in: placeIds } });
    res.json(places);
})

export { addAccommodation, updateAccommodation, deleteAccommodation, rateAccommodation, getPlaceRatings, getMyAccommodations, bookAccommodation, cancelBooking, getMyBookings, getAccommodationById, getAccommodations, loadTrie, searchByName }