'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    recipient  : { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type       : {
      type: String,
      enum: [
        'announcement','fee_due','attendance_low','result_published',
        'exam_scheduled','assignment_due','grievance_update','system',
        'password_changed','account_status','document_verified',
      ],
      required: true,
    },
    title      : { type: String, required: true },
    message    : { type: String, required: true },

    // ── Reference to triggering entity ────────────────────
    entityType : { type: String }, // 'Announcement', 'FeeRecord', etc.
    entityId   : { type: Schema.Types.ObjectId },

    isRead     : { type: Boolean, default: false },
    readAt     : { type: Date },

    // ── Delivery channels ─────────────────────────────────
    channels   : [{ type: String, enum: ['in_app','email','sms','push'] }],
    deliveredVia: [{ type: String }],

    priority   : { type: String, enum: ['low','normal','high'], default: 'normal' },
    expiresAt  : { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;

