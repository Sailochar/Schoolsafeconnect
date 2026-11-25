/**
 * Assessment Model
 * Manages school exams, AI-corrected OMR answer keys, evaluations, and grading.
 */

const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    classCode: {
      type: String,
      required: true,
      trim: true,
      index: true // e.g. SSC-SCH-1001-CLS-6A
    },
    title: {
      type: String,
      required: true,
      trim: true // e.g. "Term 1 Mathematics Assessment"
    },
    assessmentType: {
      type: String,
      required: true,
      trim: true,
      index: true // FA-1, FA-2, FA-3, FA-4, SA-1, SA-2, or custom like "Unit Test 1"
    },
    subject: {
      type: String,
      required: true,
      trim: true // Mathematics, Science, English, etc.
    },
    academicYear: {
      type: String,
      required: true,
      default: "2026-2027",
      trim: true
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
      max: 200,
      default: 20
    },
    marksPerQuestion: {
      type: Number,
      required: true,
      default: 1,
      min: 0.5
    },
    negativeMarking: {
      type: Number,
      default: 0,
      min: 0
    },
    maxMarks: {
      type: Number,
      required: true,
      default: 20
    },
    answerKey: [
      {
        questionNumber: { type: Number, required: true },
        correctAnswer: { type: String, required: true, uppercase: true, enum: ["A", "B", "C", "D"] }
      }
    ],
    status: {
      type: String,
      enum: ["DRAFT", "EVALUATED", "PUBLISHED"],
      default: "DRAFT",
      index: true
    },
    results: [
      {
        studentCode: { type: String, required: true, index: true },
        admissionNumber: { type: String, required: true },
        studentName: { type: String, required: true },
        omrFileName: { type: String, default: "" },
        markedAnswers: [
          {
            questionNumber: { type: Number, required: true },
            markedAnswer: { type: String, default: null }, // "A", "B", "C", "D", or null
            isCorrect: { type: Boolean, default: false }
          }
        ],
        totalAttempted: { type: Number, default: 0 },
        correctCount: { type: Number, default: 0 },
        wrongCount: { type: Number, default: 0 },
        unattemptedCount: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        grade: { type: String, default: "F" }, // A+, A, B, C, D, F
        rank: { type: Number, default: 1 },
        feedback: { type: String, default: "" },
        evaluatedAt: { type: Date, default: Date.now },
        whatsappNotified: { type: Boolean, default: false },
        whatsappNotifiedAt: { type: Date }
      }
    ],
    summary: {
      totalStudentsEvaluated: { type: Number, default: 0 },
      classAverageScore: { type: Number, default: 0 },
      highestScore: { type: Number, default: 0 },
      lowestScore: { type: Number, default: 0 },
      passRate: { type: Number, default: 0 }
    },
    createdBy: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

assessmentSchema.index({ schoolCode: 1, classCode: 1, assessmentType: 1 });
assessmentSchema.index({ schoolCode: 1, status: 1 });

const Assessment = mongoose.model("Assessment", assessmentSchema);

module.exports = Assessment;
