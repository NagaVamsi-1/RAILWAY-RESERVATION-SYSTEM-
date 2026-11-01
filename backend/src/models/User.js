
const mongoose = require("mongoose");
const { LANGUAGE_CODES } = require("../config/languages");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    // BL-15: the passenger's chosen interface language (unset until they pick one).
    preferredLanguage: {
      type: String,
      enum: LANGUAGE_CODES,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
