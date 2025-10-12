const mongoose = require("mongoose");

async function connectDB() {
  try {
    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log("MongoDB already connected");
      return;
    }

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI environment variable is not defined");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    // process.exit(1);
  }
}

module.exports = connectDB;
