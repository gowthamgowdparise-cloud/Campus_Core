'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DocumentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type : {
      type    : String,
      enum    : [
        'admission_form', 'marksheet', 'transfer_certificate', 'migration_certificate',
        'bonafide', 'fee_receipt', 'id_card', 'character_certificate', 'noc',
        'scholarship_form', 'other',
      ],
      required: true,
    },

    // ── Ownership ─────────────────────────────────────────
    owner  : { type: Schema.Types.ObjectId, ref: 'User',    required: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', default: null },

    // ── File details ──────────────────────────────────────
    fileName       : { type: String, required: true },
    filePath       : { type: String, required: true },
    storageProvider: { type: String, enum: ['local', 's3', 'external'], default: 'local' },
    storageKey     : { type: String, trim: true, default: null },
    fileSize       : { type: Number, min: 0 }, // bytes
    mimeType       : { type: String },
    fileHash       : { type: String }, // sha256 for integrity

    // ── Verification ──────────────────────────────────────
    isVerified     : { type: Boolean, default: false },
    verifiedBy     : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt     : { type: Date },
    rejectionReason: { type: String },

    status: {
      type   : String,
      enum   : ['uploaded', 'under_review', 'verified', 'rejected', 'expired'],
      default: 'uploaded',
    },

    expiresAt : { type: Date },
    isPublic  : { type: Boolean, default: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

DocumentSchema.index({ owner: 1, type: 1 });
DocumentSchema.index({ student: 1 });
DocumentSchema.index({ status: 1 });
DocumentSchema.index({ isDeleted: 1 });

DocumentSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Document = mongoose.model('Document', DocumentSchema);
module.exports = Document;
