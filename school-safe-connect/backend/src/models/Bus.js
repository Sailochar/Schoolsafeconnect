/**
 * Bus Model
 * School transport vehicle definition.
 */

const mongoose = require("mongoose");

const busSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    busCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-BUS-012
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    busNumber: {
      type: String,
      required: true,
      trim: true // e.g. "Bus 12"
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    driverCode: {
      type: String,
      trim: true,
      index: true // e.g. SSC-SCH-1023-DRV-003
    },
    routeCode: {
      type: String,
      trim: true,
      index: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "MAINTENANCE", "INACTIVE"],
      default: "ACTIVE",
      index: true
    },
    makeModel: {
      type: String,
      trim: true
    },
    gpsDeviceId: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

busSchema.index({ schoolCode: 1, registrationNumber: 1 }, { unique: true });

const Bus = mongoose.model("Bus", busSchema);

module.exports = Bus;
