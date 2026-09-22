const mongoose = require('mongoose');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGO_DB);
  console.log("Database connected");
};


module.exports = connectDB
