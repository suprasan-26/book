import mongoose from "mongoose";

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide username"]
    },
    email: {
        type: String,
        required: [true, "Please provide an email address"],
        unique: [true, "email already taken"]
    },
    password: {
        type: String,
        required: [true, "Please enter password"]
    },
    language: {
        type: [String],
        required: [true, "Please enter languages known"]
    },
    profilePic: {
        type: String,
    },
    favourites: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Place", // Reference to the Place model
        },
    ],
}, {
    timestamps: true
});

export default mongoose.model("User", userSchema); 