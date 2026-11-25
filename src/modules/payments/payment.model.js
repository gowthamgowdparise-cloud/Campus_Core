'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const PaymentSchema = new Schema(
  {
    student      : { type: Schema.Types.ObjectId, ref: 'Student',   required: true },
    feeRecord    : { type: Schema.Types.ObjectId, ref: 'FeeRecord', required: true },
    receiptNumber: { type: String, required: true, trim: true },

    amount: { type: Number, required: true, min: 1 },
    paidAt: { type: Date,   required: true, default: Date.now },

    mode: {
      type    : String,
      enum    : ['online', 'cash', 'dd', 'cheque', 'neft', 'rtgs', 'upi', 'card'],
      required: true,
    },

    // External payment provider fields (zero secrets/card credentials stored)
    provider          : { type: String, enum: ['manual', 'razorpay', 'stripe'], default: 'manual' },
    providerOrderId   : { type: String, trim: true },
    providerPaymentId : { type: String, trim: true },
    webhookEventId    : { type: String, trim: true },
    providerVerifiedAt: { type: Date },
    providerMetadata  : { type: Schema.Types.Mixed },
    failureReason     : { type: String, trim: true },

    // Online / instrument reference details
    transactionId  : { type: String, trim: true },
    idempotencyKey : { type: String, trim: true },
    bankName       : { type: String },
    chequeNumber   : { type: String },
    chequeDate     : { type: Date },
    ddNumber       : { type: String },

    status: {
      type   : String,
      enum   : ['pending', 'success', 'failed', 'refunded', 'cancelled'],
      default: 'success',
    },

    // Reconciliation support
    isReconciled           : { type: Boolean, default: false },
    reconciliationStatus   : {
      type   : String,
      enum   : ['unreconciled', 'matched', 'discrepancy'],
      default: 'unreconciled',
    },
    reconciledAt           : { type: Date },
    reconciledBy           : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reconciliationReference: { type: String, trim: true },

    // Collected by (for cash/offline)
    collectedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    remarks    : { type: String },
  },
  { timestamps: true }
);

PaymentSchema.index({ receiptNumber: 1 },   { unique: true });
PaymentSchema.index({ transactionId: 1 },   { unique: true, sparse: true });
PaymentSchema.index({ idempotencyKey: 1 },  { unique: true, sparse: true });
PaymentSchema.index({ webhookEventId: 1 },  { unique: true, sparse: true });
PaymentSchema.index({ providerOrderId: 1 }, { sparse: true });
PaymentSchema.index({ providerPaymentId: 1 }, { sparse: true });
PaymentSchema.index({ student: 1, paidAt: -1 });
PaymentSchema.index({ feeRecord: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ reconciliationStatus: 1 });

const Payment = mongoose.model('Payment', PaymentSchema);
module.exports = Payment;
