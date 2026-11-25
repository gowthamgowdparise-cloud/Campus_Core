'use strict';

const crypto   = require('crypto');
const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Collision-resistant synchronous ticket number generator */
const generateTicketNumber = () => {
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix    = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `GRV-${dateStamp}-${suffix}`;
};

const GrievanceCommentSchema = new Schema(
  {
    author    : { type: Schema.Types.ObjectId, ref: 'User', required: true },
    comment   : { type: String, required: true },
    isInternal: { type: Boolean, default: false }, // internal staff note
  },
  { timestamps: true, _id: true }
);

const GrievanceSchema = new Schema(
  {
    ticketNumber: {
      type    : String,
      required: true,
      trim    : true,
      default : generateTicketNumber,
    },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    student : { type: Schema.Types.ObjectId, ref: 'Student', default: null },

    category: {
      type    : String,
      enum    : [
        'academic', 'fee', 'examination', 'attendance', 'facility', 'hostel',
        'library', 'administration', 'harassment', 'other',
      ],
      required: true,
    },
    subject    : { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true },
    priority   : { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },

    status: {
      type   : String,
      enum   : ['open', 'in_progress', 'awaiting_response', 'resolved', 'closed', 'rejected'],
      default: 'open',
    },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User',       default: null },
    department: { type: Schema.Types.ObjectId, ref: 'Department', default: null },

    comments   : [GrievanceCommentSchema],
    attachments: [{ type: String }],

    resolvedAt: { type: Date },
    closedAt  : { type: Date },
    resolution: { type: String },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

GrievanceSchema.index({ ticketNumber: 1 }, { unique: true });
GrievanceSchema.index({ raisedBy: 1, status: 1 });
GrievanceSchema.index({ assignedTo: 1, status: 1 });
GrievanceSchema.index({ category: 1, priority: 1 });
GrievanceSchema.index({ isDeleted: 1 });

GrievanceSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Grievance = mongoose.model('Grievance', GrievanceSchema);
module.exports = Grievance;
