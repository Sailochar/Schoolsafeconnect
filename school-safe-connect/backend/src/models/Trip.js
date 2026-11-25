/**
 * Trip Model
 * Live operational bus run.
 */

const mongoose = require("mongoose");
const { TRIP_STATUS } = require("../config/constants");

const tripSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    tripId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    busCode: {
      type: String,
      required: true,
      index: true
    },
    routeCode: {
      type: String,
      required: true,
      index: true
    },
    driverCode: {
      type: String,
      required: true,
      index: true
    },
    tripType: {
      type: String,
      enum: ["MORNING_PICKUP", "AFTERNOON_DROP", "SPECIAL"],
      required: true
    },
    status: {
      type: String,
      enum: Object.values(TRIP_STATUS),
      default: TRIP_STATUS.NOT_STARTED,
      index: true
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    currentStopId: {
      type: String
    },
    delayedByMinutes: {
      type: Number,
      default: 0
    },
    delayReason: {
      type: String
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        coordinates: { type: [Number] },
        notes: { type: String }
      }
    ]
  },
  {
    timestamps: true
  }
);

tripSchema.index({ schoolCode: 1, status: 1, createdAt: -1 });

const Trip = mongoose.model("Trip", tripSchema);

module.exports = Trip;
