/**
 * Camera Model
 * CCTV camera entity. RTSP URLs and raw stream endpoints are strictly protected server-side.
 */

const mongoose = require("mongoose");

const cameraSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    cameraCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-CAM-004
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    classCode: {
      type: String,
      required: true,
      index: true // e.g. SSC-SCH-1023-CLS-6A
    },
    // CRITICAL SECURITY: Never expose RTSP credentials or URLs to the client
    rtspUrl: {
      type: String,
      required: true,
      select: false
    },
    status: {
      type: String,
      enum: ["ONLINE", "OFFLINE", "MAINTENANCE"],
      default: "ONLINE",
      index: true
    },
    allowedRoles: [
      {
        type: String,
        trim: true
      }
    ],
    allowedUserCodes: [
      {
        type: String,
        trim: true
      }
    ],
    // Privacy zone flag: washroom, medical-room, staff-room are strictly forbidden
    privacyZone: {
      type: Boolean,
      default: false
    },
    streamChannelKey: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

cameraSchema.index({ schoolCode: 1, classCode: 1, status: 1 });

const Camera = mongoose.model("Camera", cameraSchema);

module.exports = Camera;
