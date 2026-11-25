'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const AnnouncementSchema = new Schema(
  {
    title  : { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true },
    type   : {
      type   : String,
      enum   : ['general', 'academic', 'exam', 'fee', 'event', 'holiday', 'urgent'],
      default: 'general',
    },

    // ── Targeting ─────────────────────────────────────────
    targetRoles: [{
      type: String,
      enum: ['admin', 'faculty', 'student', 'all'],
    }],
    targetDepartments: [{ type: Schema.Types.ObjectId, ref: 'Department' }],
    targetPrograms   : [{ type: Schema.Types.ObjectId, ref: 'Program' }],
    targetSections   : [{ type: Schema.Types.ObjectId, ref: 'Section' }],

    // ── Scheduling ────────────────────────────────────────
    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    isPinned : { type: Boolean, default: false },
    priority : { type: String, enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },

    // ── Attachments ───────────────────────────────────────
    attachments: [{ type: String }], // file paths / URLs

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isActive : { type: Boolean, default: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ targetRoles: 1, isActive: 1 });
AnnouncementSchema.index({ publishAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });
AnnouncementSchema.index({ isPinned: -1, priority: -1 });
AnnouncementSchema.index({ isDeleted: 1 });

AnnouncementSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Announcement = mongoose.model('Announcement', AnnouncementSchema);
module.exports = Announcement;
