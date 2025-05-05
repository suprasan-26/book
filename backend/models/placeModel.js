import mongoose from "mongoose";

const placeSchema = mongoose.Schema({
    owner: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: "User",
    },
    title: {
        type: String,
        required: [true, "Please provide title"]
    },
    address: {
        street: {
            type: String,
            required: [true, "Please provide street address"]
        },
        locality: {
            type: String,
            required: [true, "Please provide locality"]
        },
        city: {
            type: String,
            required: [true, "Please provide city"]
        },
        pincode: {
            type: String,
            required: [true, "Please provide pincode"]
        },
        country: {
            type: String,
            required: [true, "Please provide country"]
        },
    },
    photos: {
        type: [String],
        required: [true, "Please add photos"]
    },
    description: {
        type: String,
        required: [true, "Please provide description"]
    },
    perks: {
        type: [String]
    },
    extraInfo: {
        type: String
    },
    checkIn: {
        type: Number,
        required: [true, "Please provide check in time"]
    },
    checkOut: {
        type: Number,
        required: [true, "Please provide check out time"]
    },
    maxGuests: {
        type: Number,
        required: [true, "Please provide maximum number of guests"]
    },
    price: {
        type: Number,
        required: [true, "Please provide price"]
    },
    rating: {
        type: [Number]
    },
    ratedBy: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    ],
});

export default mongoose.model("Place", placeSchema); 