'use strict';

const mongoose = require('mongoose');
const AppError = require('../../utils/AppError');

const { Schema } = mongoose;

/**
 * AuditLog – immutable record of every significant action in the system.
 * Updates and ordinary deletes are blocked at the schema layer.
 */
const AuditLogSchema = new Schema(
  {
    actor     : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole : { type: String, enum: ['admin', 'faculty', 'student', 'system', 'anonymous'], default: 'anonymous' },
    actorEmail: { type: String, default: null },

    action  : { type: String, required: true },
    module  : { type: String, required: true },
    method  : { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    endpoint: { type: String },

    entityType: { type: String },
    entityId  : { type: Schema.Types.ObjectId },

    before : { type: Schema.Types.Mixed },
    after  : { type: Schema.Types.Mixed },
    changes: [{ field: String, from: Schema.Types.Mixed, to: Schema.Types.Mixed }],

    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },

    status      : { type: String, enum: ['success', 'failure', 'partial'], default: 'success' },
    statusCode  : { type: Number },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    strict    : true,
  }
);

// Prevent updates to preserve tamper-evident audit history
AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function (next) {
  return next(new AppError('Audit logs are immutable and cannot be modified.', 403));
});

// Prevent deletions outside explicit isolated test cleanup
AuditLogSchema.pre(['deleteOne', 'deleteMany', 'findOneAndDelete'], function (next) {
  if (process.env.NODE_ENV === 'test' && this.getOptions().allowCleanupInTest) {
    return next();
  }
  return next(new AppError('Audit logs are immutable and cannot be deleted.', 403));
});

AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, module: 1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ requestId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ status: 1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
module.exports = AuditLog;
