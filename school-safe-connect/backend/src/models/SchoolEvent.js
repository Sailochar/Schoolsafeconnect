/**
 * SchoolEvent Model
 * Events Gallery with 1-Week (7-day) automatic expiry.
 */

const mongoose = require("mongoose");

const schoolEventSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      enum: ["SPORTS", "CULTURAL", "ACADEMIC", "ANNUAL_DAY", "EXCURSION", "CAMPUS", "CELEBRATION"],
      default: "CAMPUS"
    },
    eventDate: {
      type: Date,
      default: Date.now
    },
    images: {
      type: [String],
      required: true,
      validate: [(val) => val.length > 0, "At least one image is required for the event gallery."]
    },
    uploader: {
      userCode: { type: String, required: true },
      fullName: { type: String, required: true },
      role: { type: String, required: true }
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Exactly 1 week
      index: { expires: 0 } // MongoDB TTL index to auto-remove after 7 days
    }
  },
  {
    timestamps: true
  }
);

schoolEventSchema.index({ schoolCode: 1, createdAt: -1 });
schoolEventSchema.index({ schoolCode: 1, expiresAt: 1 });

const SchoolEvent = mongoose.model("SchoolEvent", schoolEventSchema);

module.exports = SchoolEvent;
