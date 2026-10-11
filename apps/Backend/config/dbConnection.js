const mongoose = require('mongoose');

const connectDB = async (uri = process.env.MONGO_DB) => {
  // Indexes and collections are prepared separately after a guarded preflight.
  // Model loading (including Model.init()) must not mutate the database.
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
  console.log("Database connected");
};


module.exports = connectDB
