import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import dotenv from "dotenv";

dotenv.config();

const connectDb = asyncHandler(async () => {
    const connect = await mongoose.connect(process.env.CONNECTION_STRING);
    console.log("database connected: ",connect.connection.host);
});

export default connectDb;