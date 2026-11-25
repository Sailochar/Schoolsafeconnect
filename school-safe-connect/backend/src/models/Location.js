/**
 * Location Model
 * High-frequency GPS telemetry records with enforced delayed-visibility timestamps.
 */

const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
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
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    speedKmph: {
      type: Number,
      default: 0
    },
    accuracyMeters: {
      type: Number,
      default: 0
    },
    deviceTimestamp: {
      type: Date,
      required: true
    },
    serverReceivedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    visibleAfter: {
      type: Date,
      required: true,
      index: true // Delayed timestamp: queries enforce visibleAfter <= new Date()
    },
    isFlaggedSpoofed: {
      type: Boolean,
      default: false
    },
    spoofReason: {
      type: String
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

// High-performance compound indexes for real-time delayed queries
locationSchema.index({ schoolCode: 1, tripId: 1, visibleAfter: -1 });
locationSchema.index({ schoolCode: 1, busCode: 1, visibleAfter: -1 });

const Location = mongoose.model("Location", locationSchema);

module.exports = Location;
