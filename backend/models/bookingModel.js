import mongoose from "mongoose";

const bookingSchema = mongoose.Schema({
    place: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: "Place",
    },
    client: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: "User",
    },
    checkIn: {
        type: Date,
        required: [true, "Please provide check in time"]
    },
    checkOut: {
        type: Date,
        required: [true, "Please provide check out time"]
    },
    guests: {
        type: Number,
        required: [true, "Please provide number of guests"]
    },
    nights: {
        type: Number,
        required: [true, "Please provide number of nights"]
    },
    price: {
        type: Number,
        required: [true, "Please provide price"]
    },
});

export default mongoose.model("Booking", bookingSchema); 