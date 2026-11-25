/**
 * Route Model
 * Transport transit route definition with ordered stop waypoints.
 */

const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    routeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    routeName: {
      type: String,
      required: true,
      trim: true
    },
    startLocation: {
      name: { type: String, required: true },
      coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    endLocation: {
      name: { type: String, required: true },
      coordinates: { type: [Number], required: true } // [longitude, latitude]
    },
    stops: [
      {
        stopId: { type: String, required: true },
        stopName: { type: String, required: true },
        sequenceOrder: { type: Number, required: true },
        scheduledPickupTime: { type: String, required: true },
        scheduledDropTime: { type: String, required: true },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
      }
    ],
    busCode: {
      type: String,
      index: true
    },
    driverCode: {
      type: String,
      index: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE"
    }
  },
  {
    timestamps: true
  }
);

routeSchema.index({ schoolCode: 1, status: 1 });

const Route = mongoose.model("Route", routeSchema);

module.exports = Route;
