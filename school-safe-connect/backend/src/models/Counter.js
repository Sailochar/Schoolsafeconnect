/**
 * Counter Model
 * Atomic sequence generator for collision-free, hierarchical identity codes.
 */

const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema(
  {
    sequenceName: {
      type: String,
      required: true,
      trim: true
    },
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      default: "GLOBAL" // 'GLOBAL' for schoolCode sequences, or 'SSC-SCH-XXXX' for tenant sequences
    },
    sequenceValue: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

counterSchema.index({ sequenceName: 1, schoolCode: 1 }, { unique: true });

const Counter = mongoose.model("Counter", counterSchema);

module.exports = Counter;
