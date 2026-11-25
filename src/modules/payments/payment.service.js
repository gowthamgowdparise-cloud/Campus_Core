'use strict';

const crypto       = require('crypto');
const Payment      = require('./payment.model');
const FeeRecord    = require('../fees/feeRecord.model');
const Student      = require('../students/student.model');
const Notification = require('../notifications/notification.model');
const AppError     = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');
const { getPaymentProvider }  = require('../../services/payments');
const { recordSecurityAudit } = require('../../middleware/auditLogger');

const generateReceiptNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `RCP-${datePart}-${randPart}`;
};

const populatePayment = (query) =>
  query
    .populate({
      path    : 'student',
      select  : 'rollNumber enrollmentNumber program user',
      populate: [
        { path: 'user', select: 'firstName lastName email' },
        { path: 'program', select: 'name code' },
      ],
    })
    .populate('feeRecord', 'totalDemand totalPaid totalDue lateFine concessionAmount status dueDate')
    .populate('collectedBy', 'firstName lastName email');

const listPayments = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.feeRecord)            filter.feeRecord = query.feeRecord;
  if (query.mode)                 filter.mode = query.mode;
  if (query.status)               filter.status = query.status;
  if (query.reconciliationStatus) filter.reconciliationStatus = query.reconciliationStatus;

  if (caller.role === 'student') {
    if (!caller.studentProfile) throw new AppError('Student profile not linked', 403);
    filter.student = caller.studentProfile;
  } else if (query.student) {
    filter.student = query.student;
  }

  const [payments, total] = await Promise.all([
    populatePayment(Payment.find(filter)).sort({ paidAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);

  return { payments, meta: buildPaginationMeta({ page, limit, total }) };
};

const getPaymentById = async (id, caller) => {
  const payment = await populatePayment(Payment.findById(id));
  if (!payment) throw new AppError('Payment record not found', 404);

  if (caller.role === 'student' && String(payment.student._id) !== String(caller.studentProfile)) {
    throw new AppError('You do not have permission to view another student payment.', 403);
  }
  return payment;
};

const getReceipt = async (id, caller) => {
  const payment = await getPaymentById(id, caller);
  return {
    receiptNumber       : payment.receiptNumber,
    paidAt              : payment.paidAt,
    amount              : payment.amount,
    mode                : payment.mode,
    status              : payment.status,
    transactionId       : payment.transactionId || null,
    reconciliationStatus: payment.reconciliationStatus,
    student             : payment.student,
    feeRecord           : payment.feeRecord,
    collectedBy         : payment.collectedBy,
    remarks             : payment.remarks,
    note                : 'Official transaction receipt generated from verified CAMPUSCORE payment ledger.',
  };
};

/**
 * Record a fee payment atomically with idempotency protection.
 * Note: Student-submitted payment references are recorded as 'pending' awaiting admin verification/reconciliation
 * so students can never directly mark payment status as 'success' or self-clear dues.
 */
const recordPayment = async (payload, caller) => {
  if (payload.idempotencyKey) {
    const existingIdem = await Payment.findOne({ idempotencyKey: payload.idempotencyKey });
    if (existingIdem) {
      if (caller.role === 'student' && String(existingIdem.student) !== String(caller.studentProfile)) {
        throw new AppError('Idempotency key conflict', 409);
      }
      return populatePayment(Payment.findById(existingIdem._id));
    }
  }

  return runInTransaction(async (session) => {
    const feeRecord = await FeeRecord.findById(payload.feeRecord).session(session);
    if (!feeRecord) throw new AppError('Fee record not found', 404);

    if (caller.role === 'student') {
      if (String(feeRecord.student) !== String(caller.studentProfile)) {
        throw new AppError('You can only submit payment references for your own fee record.', 403);
      }
      if (['cash', 'dd', 'cheque'].includes(payload.mode)) {
        throw new AppError('Offline cash/DD/cheque payments must be recorded by administration.', 403);
      }
    }

    if (['paid', 'waived', 'refunded'].includes(feeRecord.status) || feeRecord.totalDue <= 0) {
      throw new AppError('Fee record has no outstanding due balance.', 400);
    }

    if (payload.amount > feeRecord.totalDue) {
      throw new AppError(`Payment amount (${payload.amount}) exceeds outstanding due (${feeRecord.totalDue})`, 400);
    }

    const isAdminPayment = caller.role === 'admin';
    const paymentStatus  = isAdminPayment ? 'success' : 'pending';

    const [payment] = await Payment.create(
      [
        {
          student             : feeRecord.student,
          feeRecord           : feeRecord._id,
          receiptNumber       : generateReceiptNumber(),
          amount              : payload.amount,
          paidAt              : new Date(),
          mode                : payload.mode,
          transactionId       : payload.transactionId || undefined,
          idempotencyKey      : payload.idempotencyKey || undefined,
          bankName            : payload.bankName,
          chequeNumber        : payload.chequeNumber,
          chequeDate          : payload.chequeDate,
          ddNumber            : payload.ddNumber,
          status              : paymentStatus,
          reconciliationStatus: isAdminPayment ? 'matched' : 'unreconciled',
          isReconciled        : isAdminPayment,
          reconciledAt        : isAdminPayment ? new Date() : undefined,
          reconciledBy        : isAdminPayment ? caller.id : undefined,
          collectedBy         : isAdminPayment ? caller.id : null,
          remarks             : payload.remarks,
        },
      ],
      { session }
    );

    feeRecord.payments.push(payment._id);
    if (paymentStatus === 'success') {
      feeRecord.totalPaid += payload.amount;
    }
    await feeRecord.save({ session });

    const stu = await Student.findById(feeRecord.student).select('user').session(session);
    if (stu?.user) {
      await Notification.create(
        [
          {
            recipient : stu.user,
            type      : 'system',
            title     : paymentStatus === 'success' ? 'Fee Payment Recorded' : 'Payment Reference Submitted',
            message   : `Payment of ${payload.amount} (Receipt: ${payment.receiptNumber}) is ${paymentStatus}.`,
            entityType: 'Payment',
            entityId  : payment._id,
            channels  : ['in_app'],
          },
        ],
        { session }
      );
    }

    return populatePayment(Payment.findById(payment._id).session(session));
  });
};

const reconcilePayment = async (id, payload, callerId) => {
  return runInTransaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (!payment) throw new AppError('Payment record not found', 404);

    const prevStatus = payment.status;
    const nextStatus = payload.paymentStatus || prevStatus;

    if (prevStatus === 'pending' && nextStatus === 'success') {
      const feeRecord = await FeeRecord.findById(payment.feeRecord).session(session);
      if (!feeRecord) throw new AppError('Associated fee record not found', 404);
      if (payment.amount > feeRecord.totalDue) {
        throw new AppError(`Cannot settle payment (${payment.amount}) exceeding current due (${feeRecord.totalDue})`, 400);
      }
      feeRecord.totalPaid += payment.amount;
      await feeRecord.save({ session });
    } else if (prevStatus === 'success' && (nextStatus === 'cancelled' || nextStatus === 'failed')) {
      const feeRecord = await FeeRecord.findById(payment.feeRecord).session(session);
      if (feeRecord) {
        feeRecord.totalPaid = Math.max(0, feeRecord.totalPaid - payment.amount);
        await feeRecord.save({ session });
      }
    }

    payment.status                  = nextStatus;
    payment.isReconciled            = payload.reconciliationStatus === 'matched';
    payment.reconciliationStatus    = payload.reconciliationStatus;
    payment.reconciliationReference = payload.reconciliationReference;
    payment.reconciledAt            = new Date();
    payment.reconciledBy            = callerId;
    if (payload.remarks) payment.remarks = payload.remarks;
    await payment.save({ session });

    return populatePayment(Payment.findById(payment._id).session(session));
  });
};

const getReconciliationSummary = async () => {
  const [byReconciliation, byStatus] = await Promise.all([
    Payment.aggregate([
      { $group: { _id: '$reconciliationStatus', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]),
  ]);

  return { byReconciliation, byStatus };
};

/**
 * Initiate an online payment order/intent via the configured payment gateway provider
 * (e.g. Razorpay/Stripe). Returns 503 cleanly if gateway credentials are not configured.
 */
const initiateProviderPayment = async (payload, caller) => {
  if (payload.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: payload.idempotencyKey });
    if (existing) {
      if (caller.role === 'student' && String(existing.student) !== String(caller.studentProfile)) {
        throw new AppError('Idempotency key conflict', 409);
      }
      return {
        payment : await populatePayment(Payment.findById(existing._id)),
        provider: {
          name           : existing.provider,
          providerOrderId: existing.providerOrderId,
          ...(existing.providerMetadata || {}),
        },
      };
    }
  }

  const feeRecord = await FeeRecord.findById(payload.feeRecord);
  if (!feeRecord) throw new AppError('Fee record not found', 404);

  if (caller.role === 'student' && String(feeRecord.student) !== String(caller.studentProfile)) {
    throw new AppError('You can only initiate payments for your own fee record.', 403);
  }
  if (['paid', 'waived', 'refunded'].includes(feeRecord.status) || feeRecord.totalDue <= 0) {
    throw new AppError('Fee record has no outstanding due balance.', 400);
  }
  if (payload.amount > feeRecord.totalDue) {
    throw new AppError(`Payment amount (${payload.amount}) exceeds outstanding due (${feeRecord.totalDue})`, 400);
  }

  const provider      = getPaymentProvider(payload.provider || null);
  const receiptNumber = generateReceiptNumber();
  const order         = await provider.createOrder({
    amountInMajorUnits: payload.amount,
    receiptNumber,
    notes: {
      feeRecordId: String(feeRecord._id),
      studentId  : String(feeRecord.student),
    },
  });

  const saved = await runInTransaction(async (session) => {
    const [payment] = await Payment.create(
      [
        {
          student             : feeRecord.student,
          feeRecord           : feeRecord._id,
          receiptNumber,
          amount              : payload.amount,
          paidAt              : new Date(),
          mode                : 'online',
          provider            : provider.providerName,
          providerOrderId     : order.providerOrderId,
          providerMetadata    : order.publicConfig,
          idempotencyKey      : payload.idempotencyKey || undefined,
          status              : 'pending',
          reconciliationStatus: 'unreconciled',
          isReconciled        : false,
          remarks             : payload.remarks,
        },
      ],
      { session }
    );

    await FeeRecord.updateOne(
      { _id: feeRecord._id },
      { $addToSet: { payments: payment._id } },
      { session }
    );

    return populatePayment(Payment.findById(payment._id).session(session));
  });

  return {
    payment : saved,
    provider: {
      name           : provider.providerName,
      providerOrderId: order.providerOrderId,
      amountMinor    : order.amountMinor,
      currency       : order.currency,
      ...order.publicConfig,
    },
  };
};

/**
 * Verify provider checkout signature and atomically settle FeeRecord balance.
 */
const verifyProviderPayment = async (id, payload, caller) => {
  const preCheck = await Payment.findById(id);
  if (!preCheck) throw new AppError('Payment record not found', 404);

  if (caller.role === 'student' && String(preCheck.student) !== String(caller.studentProfile)) {
    throw new AppError('You do not have permission to verify another student payment.', 403);
  }
  if (!preCheck.provider || preCheck.provider === 'manual') {
    throw new AppError('Payment was not initiated with an online gateway provider.', 400);
  }
  if (preCheck.providerOrderId !== payload.providerOrderId) {
    throw new AppError('Mismatched providerOrderId for this payment.', 400);
  }

  const provider = getPaymentProvider(preCheck.provider);
  provider.verifyCheckoutSignature(payload);

  return runInTransaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (payment.status === 'success') {
      return populatePayment(Payment.findById(payment._id).session(session));
    }

    const feeRecord = await FeeRecord.findById(payment.feeRecord).session(session);
    if (!feeRecord) throw new AppError('Associated fee record not found', 404);
    if (payment.amount > feeRecord.totalDue) {
      throw new AppError(`Cannot settle payment (${payment.amount}) exceeding current due (${feeRecord.totalDue})`, 400);
    }

    feeRecord.totalPaid += payment.amount;
    await feeRecord.save({ session });

    payment.status               = 'success';
    payment.isReconciled         = true;
    payment.reconciliationStatus = 'matched';
    payment.reconciledAt         = new Date();
    payment.providerPaymentId    = payload.providerPaymentId;
    payment.transactionId        = payment.transactionId || payload.providerPaymentId;
    payment.providerVerifiedAt   = new Date();
    await payment.save({ session });

    const stu = await Student.findById(feeRecord.student).select('user').session(session);
    if (stu?.user) {
      await Notification.create(
        [
          {
            recipient : stu.user,
            type      : 'system',
            title     : 'Fee Payment Verified',
            message   : `Payment of ${payment.amount} (Receipt: ${payment.receiptNumber}) succeeded.`,
            entityType: 'Payment',
            entityId  : payment._id,
            channels  : ['in_app'],
          },
        ],
        { session }
      );
    }

    return populatePayment(Payment.findById(payment._id).session(session));
  });
};

/**
 * Process signed payment-provider webhooks with strict HMAC validation & webhookEventId idempotency.
 */
const processProviderWebhook = async (providerName, req) => {
  const provider = getPaymentProvider(providerName);
  const verified = provider.verifyWebhook({
    rawBody: req.rawBody,
    headers: req.headers,
    body   : req.body,
  });

  if (!verified.eventId) {
    throw new AppError('Webhook event ID could not be determined', 400);
  }

  const alreadyProcessed = await Payment.exists({ webhookEventId: verified.eventId });
  if (alreadyProcessed) {
    return { acknowledged: true, duplicate: true, eventId: verified.eventId };
  }

  if (!verified.status || !verified.providerOrderId) {
    return { acknowledged: true, ignored: true, eventType: verified.eventType };
  }

  return runInTransaction(async (session) => {
    const duplicateInTx = await Payment.exists({ webhookEventId: verified.eventId }).session(session);
    if (duplicateInTx) {
      return { acknowledged: true, duplicate: true, eventId: verified.eventId };
    }

    const payment = await Payment.findOne({
      provider       : provider.providerName,
      providerOrderId: verified.providerOrderId,
    }).session(session);

    if (!payment) {
      throw new AppError('Matching payment order not found for webhook event', 404);
    }

    const feeRecord = await FeeRecord.findById(payment.feeRecord).session(session);
    if (!feeRecord) throw new AppError('Associated fee record not found', 404);

    if (payment.status === 'pending' && verified.status === 'success') {
      if (payment.amount > feeRecord.totalDue) {
        payment.reconciliationStatus = 'discrepancy';
      } else {
        feeRecord.totalPaid += payment.amount;
        await feeRecord.save({ session });
        payment.isReconciled         = true;
        payment.reconciliationStatus = 'matched';
        payment.reconciledAt         = new Date();
      }
      payment.status = 'success';
    } else if (payment.status === 'pending' && verified.status === 'failed') {
      payment.status        = 'failed';
      payment.failureReason = verified.failureReason || 'Payment failed at provider';
    } else if (payment.status === 'success' && verified.status === 'refunded') {
      feeRecord.totalPaid = Math.max(0, feeRecord.totalPaid - payment.amount);
      await feeRecord.save({ session });
      payment.status               = 'refunded';
      payment.reconciliationStatus = 'matched';
    }

    if (verified.providerPaymentId) {
      payment.providerPaymentId = verified.providerPaymentId;
      payment.transactionId     = payment.transactionId || verified.providerPaymentId;
    }
    payment.webhookEventId     = verified.eventId;
    payment.providerVerifiedAt = new Date();
    await payment.save({ session });

    const stu = await Student.findById(feeRecord.student).select('user').session(session);
    if (stu?.user) {
      await Notification.create(
        [
          {
            recipient : stu.user,
            type      : 'system',
            title     : `Payment ${payment.status.toUpperCase()}`,
            message   : `Webhook update for receipt ${payment.receiptNumber}: status is now ${payment.status}.`,
            entityType: 'Payment',
            entityId  : payment._id,
            channels  : ['in_app'],
          },
        ],
        { session }
      );
    }

    await recordSecurityAudit({
      actorRole : 'system',
      action    : 'PAYMENT_WEBHOOK_PROCESSED',
      module    : 'payments',
      method    : 'POST',
      endpoint  : req.originalUrl,
      entityType: 'Payment',
      entityId  : payment._id,
      ipAddress : req.ip,
      requestId : req.id || null,
      statusCode: 200,
      status    : 'success',
      after     : {
        provider : provider.providerName,
        eventId  : verified.eventId,
        eventType: verified.eventType,
        status   : payment.status,
      },
    });

    return {
      acknowledged: true,
      duplicate   : false,
      eventId     : verified.eventId,
      paymentId   : payment._id,
      status      : payment.status,
    };
  });
};

module.exports = {
  listPayments,
  getPaymentById,
  getReceipt,
  recordPayment,
  initiateProviderPayment,
  verifyProviderPayment,
  processProviderWebhook,
  reconcilePayment,
  getReconciliationSummary,
};

