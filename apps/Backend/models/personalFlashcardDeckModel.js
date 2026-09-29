const mongoose = require("mongoose");

const personalFlashcardDeckSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
  },
  { timestamps: true }
);

personalFlashcardDeckSchema.index({ ownerId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("PersonalFlashcardDeck", personalFlashcardDeckSchema);
