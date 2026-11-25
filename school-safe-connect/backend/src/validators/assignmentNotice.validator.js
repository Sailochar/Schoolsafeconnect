/**
 * Assignment, Notice, and Parent Query Validators
 */

const Joi = require("joi");

const attachmentSchema = Joi.object({
  fileName: Joi.string().trim().min(1).max(255).required(),
  fileUrl: Joi.string().trim().min(1).max(2000).required(),
  fileKey: Joi.string().trim().max(500).allow(null, "").optional(),
  fileType: Joi.string().trim().max(100).allow(null, "").optional(),
  fileSize: Joi.number().integer().min(0).max(50 * 1024 * 1024).optional()
});

const createAssignmentSchema = Joi.object({
  classCode: Joi.string().trim().uppercase().optional().allow("", null),
  classCodes: Joi.array().items(Joi.string().trim().uppercase()).optional(),
  subject: Joi.string().trim().min(1).max(120).default("General"),
  title: Joi.string().trim().min(2).max(200).required(),
  description: Joi.string().trim().min(1).max(5000).required(),
  format: Joi.string().valid("PDF", "DOC", "TEXT", "MIXED").default("TEXT"),
  assignmentType: Joi.string().valid("HOMEWORK", "PROJECT", "EXAM_PREP", "WORKSHEET").default("HOMEWORK"),
  attachments: Joi.array().items(attachmentSchema).max(10).default([]),
  dueDate: Joi.date().iso().required(),
  maxScore: Joi.number().integer().min(0).max(10000).default(100),
  status: Joi.string().valid("DRAFT", "PUBLISHED").default("PUBLISHED")
});

const updateAssignmentSchema = Joi.object({
  subject: Joi.string().trim().min(1).max(120),
  title: Joi.string().trim().min(3).max(200),
  description: Joi.string().trim().min(1).max(5000),
  attachments: Joi.array().items(attachmentSchema).max(10),
  dueDate: Joi.date().iso(),
  maxScore: Joi.number().integer().min(0).max(10000),
  status: Joi.string().valid("DRAFT", "PUBLISHED", "ARCHIVED")
}).min(1);

const markViewedSchema = Joi.object({
  studentCode: Joi.string().trim().uppercase().required()
});

const publishNoticeSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200).required(),
  content: Joi.string().trim().min(1).max(10000).required(),
  category: Joi.string().valid("EXAM", "ANNOUNCEMENT", "EVENT", "URGENT", "HOLIDAY", "GENERAL").default("GENERAL"),
  publisherName: Joi.string().trim().max(150).allow("", null),
  publisherRole: Joi.string().trim().max(50).allow("", null),
  examDetails: Joi.object({
    examName: Joi.string().trim().allow("", null),
    subject: Joi.string().trim().allow("", null),
    examDate: Joi.date().iso().allow(null),
    startTime: Joi.string().trim().allow("", null),
    endTime: Joi.string().trim().allow("", null),
    syllabus: Joi.string().trim().allow("", null),
    maxMarks: Joi.number().min(0).allow(null)
  }).optional().allow(null),
  targetRoles: Joi.array()
    .items(Joi.string().trim().uppercase().valid("PARENT", "CLASS_TEACHER", "SUBJECT_TEACHER", "DRIVER", "SCHOOL_ADMIN", "TRANSPORT_COORDINATOR"))
    .min(1)
    .default(["PARENT", "CLASS_TEACHER", "SUBJECT_TEACHER"]),
  classCodes: Joi.array().items(Joi.string().trim().uppercase()).default([]),
  priority: Joi.string().valid("NORMAL", "IMPORTANT", "CRITICAL").default("NORMAL"),
  attachments: Joi.array().items(attachmentSchema).max(10).default([]),
  expiresAt: Joi.date().iso().allow(null),
  status: Joi.string().valid("PUBLISHED", "ARCHIVED").default("PUBLISHED")
});

const updateNoticeSchema = Joi.object({
  title: Joi.string().trim().min(3).max(200),
  content: Joi.string().trim().min(1).max(10000),
  category: Joi.string().valid("EXAM", "ANNOUNCEMENT", "EVENT", "URGENT", "HOLIDAY", "GENERAL"),
  publisherName: Joi.string().trim().max(150).allow("", null),
  publisherRole: Joi.string().trim().max(50).allow("", null),
  examDetails: Joi.object({
    examName: Joi.string().trim().allow("", null),
    subject: Joi.string().trim().allow("", null),
    examDate: Joi.date().iso().allow(null),
    startTime: Joi.string().trim().allow("", null),
    endTime: Joi.string().trim().allow("", null),
    syllabus: Joi.string().trim().allow("", null),
    maxMarks: Joi.number().min(0).allow(null)
  }).optional().allow(null),
  targetRoles: Joi.array()
    .items(Joi.string().trim().uppercase().valid("PARENT", "CLASS_TEACHER", "SUBJECT_TEACHER", "DRIVER", "SCHOOL_ADMIN", "TRANSPORT_COORDINATOR"))
    .min(1),
  classCodes: Joi.array().items(Joi.string().trim().uppercase()),
  priority: Joi.string().valid("NORMAL", "IMPORTANT", "CRITICAL"),
  attachments: Joi.array().items(attachmentSchema).max(10),
  expiresAt: Joi.date().iso().allow(null),
  status: Joi.string().valid("PUBLISHED", "ARCHIVED")
}).min(1);

const submitQuerySchema = Joi.object({
  studentCode: Joi.string().trim().uppercase().required(),
  classCode: Joi.string().trim().uppercase().optional().allow("", null),
  queryType: Joi.string().valid("NORMAL", "SAFETY", "MEDICAL", "BULLYING", "PANIC").default("NORMAL"),
  subject: Joi.string().trim().min(2).max(200).default("Parent Query"),
  message: Joi.string().trim().min(1).max(4000).optional(),
  question: Joi.string().trim().min(1).max(4000).optional()
}).or("message", "question");

const replyQuerySchema = Joi.object({
  reply: Joi.string().trim().min(1).max(4000).required(),
  status: Joi.string().valid("ANSWERED", "CLOSED").default("ANSWERED")
});

module.exports = {
  createAssignmentSchema,
  updateAssignmentSchema,
  markViewedSchema,
  publishNoticeSchema,
  updateNoticeSchema,
  submitQuerySchema,
  replyQuerySchema
};
