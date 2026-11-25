/**
 * Event Gallery Service
 * Manages school event gallery with 1-week (7-day) automatic expiration.
 */

const { SchoolEvent } = require("../models");
const AuditService = require("./audit.service");

class EventService {
  /**
   * List active events for tenant school (expiresAt > now)
   */
  static async listEvents({ schoolCode }) {
    const now = new Date();
    const events = await SchoolEvent.find({
      schoolCode,
      expiresAt: { $gt: now }
    })
      .sort({ createdAt: -1 })
      .lean();

    return events.map((ev) => {
      const msLeft = new Date(ev.expiresAt).getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      const hoursLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60)));
      return {
        ...ev,
        daysLeft,
        hoursLeft,
        isExpiringSoon: daysLeft <= 2
      };
    });
  }

  /**
   * Create new school event with images and 1-week expiry
   */
  static async createEvent({
    schoolCode,
    title,
    description = "",
    category = "CAMPUS",
    eventDate = new Date(),
    images = [],
    adminUser,
    ipAddress,
    userAgent
  }) {
    if (!title || !title.trim()) {
      throw new Error("Event title is required.");
    }
    if (!images || !Array.isArray(images) || images.length === 0) {
      throw new Error("At least one image is required to publish an event.");
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

    const event = await SchoolEvent.create({
      schoolCode,
      title: title.trim(),
      description: description.trim(),
      category,
      eventDate: eventDate ? new Date(eventDate) : new Date(),
      images,
      uploader: {
        userCode: adminUser.userCode,
        fullName: adminUser.fullName,
        role: adminUser.role
      },
      expiresAt
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "EVENT_GALLERY_PUBLISHED",
      resourceType: "EVENT",
      resourceId: event._id.toString(),
      ipAddress,
      userAgent,
      metadata: { title: event.title, imageCount: images.length, expiresAt }
    });

    return event;
  }

  /**
   * Delete an event manually before expiration
   */
  static async deleteEvent({ schoolCode, eventId, adminUser, ipAddress, userAgent }) {
    const event = await SchoolEvent.findOneAndDelete({ _id: eventId, schoolCode });
    if (!event) {
      throw new Error("Event not found or already expired.");
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "EVENT_GALLERY_DELETED",
      resourceType: "EVENT",
      resourceId: eventId,
      ipAddress,
      userAgent,
      metadata: { title: event.title }
    });

    return { success: true, eventId };
  }
}

module.exports = EventService;
