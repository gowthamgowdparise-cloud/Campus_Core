'use strict';

const crypto = require('crypto');
const { config } = require('../../config');
const AppError   = require('../../utils/AppError');

const safeCompareHex = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

class RazorpayProvider {
  constructor() {
    this.providerName = 'razorpay';
  }

  assertCheckoutConfigured() {
    if (!config.payments.razorpayKeyId || !config.payments.razorpayKeySecret) {
      throw new AppError(
        'Razorpay gateway credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are not configured.',
        503
      );
    }
  }

  assertWebhookConfigured() {
    if (!config.payments.razorpayWebhookSecret) {
      throw new AppError('RAZORPAY_WEBHOOK_SECRET is not configured.', 503);
    }
  }

  async createOrder({ amountInMajorUnits, currency, receiptNumber, notes = {} }) {
    this.assertCheckoutConfigured();
    const auth = Buffer.from(`${config.payments.razorpayKeyId}:${config.payments.razorpayKeySecret}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method : 'POST',
      headers: {
        Authorization : `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount  : Math.round(amountInMajorUnits * 100), // paise / minor units
        currency: currency || config.payments.currency,
        receipt : receiptNumber,
        notes,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new AppError(data?.error?.description || 'Failed to initiate Razorpay order', 502);
    }
    return {
      providerOrderId: data.id,
      amountMinor    : data.amount,
      currency       : data.currency,
      publicConfig   : { keyId: config.payments.razorpayKeyId },
    };
  }

  verifyCheckoutSignature({ providerOrderId, providerPaymentId, providerSignature }) {
    this.assertCheckoutConfigured();
    const expected = crypto
      .createHmac('sha256', config.payments.razorpayKeySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');

    if (!safeCompareHex(expected, String(providerSignature || ''))) {
      throw new AppError('Invalid Razorpay payment signature', 400);
    }
    return { verified: true };
  }

  verifyWebhook({ rawBody, headers, body }) {
    this.assertWebhookConfigured();
    const signature = headers['x-razorpay-signature'];
    if (!signature || !rawBody) {
      throw new AppError('Missing Razorpay webhook signature or raw payload', 401);
    }
    const expected = crypto
      .createHmac('sha256', config.payments.razorpayWebhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!safeCompareHex(expected, String(signature))) {
      throw new AppError('Invalid Razorpay webhook signature', 401);
    }

    const eventType     = body?.event;
    const paymentEntity = body?.payload?.payment?.entity || {};
    const eventId       = headers['x-razorpay-event-id'] || `${eventType}:${paymentEntity.id || paymentEntity.order_id}`;

    let status = null;
    if (eventType === 'payment.captured' || eventType === 'order.paid') status = 'success';
    else if (eventType === 'payment.failed')                            status = 'failed';
    else if (eventType === 'refund.processed')                          status = 'refunded';

    return {
      eventId,
      eventType,
      status,
      providerOrderId  : paymentEntity.order_id || null,
      providerPaymentId: paymentEntity.id || null,
      failureReason    : paymentEntity.error_description || null,
    };
  }
}

module.exports = { RazorpayProvider, safeCompareHex };

