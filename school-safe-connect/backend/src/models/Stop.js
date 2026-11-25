/**
 * Stop Model
 * Specific transport bus stop linked to student allocations.
 */

const mongoose = require("mongoose");

const stopSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    stopCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    routeCode: {
      type: String,
      required: true,
      index: true
    },
    stopName: {
      type: String,
      required: true,
      trim: true
    },
    sequenceOrder: {
      type: Number,
      required: true
    },
    scheduledPickupTime: {
      type: String,
      required: true
    },
    scheduledDropTime: {
      type: String,
      required: true
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    assignedStudentCodes: [
      {
        type: String,
        trim: true
      }
    ]
  },
  {
    timestamps: true
  }
);

stopSchema.index({ schoolCode: 1, routeCode: 1, sequenceOrder: 1 });
stopSchema.index({ location: "2dsphere" });

const Stop = mongoose.model("Stop", stopSchema);

module.exports = Stop;
