'use strict';

const crypto = require('crypto');
const { config } = require('../../config');
const AppError   = require('../../utils/AppError');
const { safeCompareHex } = require('./razorpay.provider');

class StripeProvider {
  constructor() {
    this.providerName = 'stripe';
  }

  assertCheckoutConfigured() {
    if (!config.payments.stripeSecretKey) {
      throw new AppError('Stripe API key (STRIPE_SECRET_KEY) is not configured.', 503);
    }
  }

  assertWebhookConfigured() {
    if (!config.payments.stripeWebhookSecret) {
      throw new AppError('STRIPE_WEBHOOK_SECRET is not configured.', 503);
    }
  }

  async createOrder({ amountInMajorUnits, currency, receiptNumber, notes = {} }) {
    this.assertCheckoutConfigured();
    const params = new URLSearchParams({
      amount  : String(Math.round(amountInMajorUnits * 100)),
      currency: (currency || config.payments.currency).toLowerCase(),
      'metadata[receiptNumber]': receiptNumber,
    });
    for (const [k, v] of Object.entries(notes)) {
      params.append(`metadata[${k}]`, String(v));
    }

    const resp = await fetch('https://api.stripe.com/v1/payment_intents', {
      method : 'POST',
      headers: {
        Authorization : `Bearer ${config.payments.stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new AppError(data?.error?.message || 'Failed to create Stripe payment intent', 502);
    }
    return {
      providerOrderId: data.id,
      amountMinor    : data.amount,
      currency       : data.currency,
      publicConfig   : { clientSecret: data.client_secret },
    };
  }

  verifyCheckoutSignature() {
    throw new AppError('Stripe checkout fulfillment is confirmed via signed Stripe webhooks.', 400);
  }

  verifyWebhook({ rawBody, headers, body }) {
    this.assertWebhookConfigured();
    const sigHeader = headers['stripe-signature'];
    if (!sigHeader || !rawBody) {
      throw new AppError('Missing Stripe webhook signature or raw payload', 401);
    }

    const parts = Object.fromEntries(
      String(sigHeader)
        .split(',')
        .map((pair) => pair.split('=').map((x) => x.trim()))
        .filter(([k, v]) => k && v)
    );
    if (!parts.t || !parts.v1) {
      throw new AppError('Malformed Stripe-Signature header', 401);
    }

    const toleranceSeconds = 300;
    const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t));
    if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
      throw new AppError('Stripe webhook timestamp outside allowed tolerance window', 401);
    }

    const signedPayload = `${parts.t}.${rawBody.toString('utf8')}`;
    const expected = crypto
      .createHmac('sha256', config.payments.stripeWebhookSecret)
      .update(signedPayload)
      .digest('hex');

    if (!safeCompareHex(expected, parts.v1)) {
      throw new AppError('Invalid Stripe webhook signature', 401);
    }

    const eventType = body?.type;
    const intent    = body?.data?.object || {};
    let status = null;
    if (eventType === 'payment_intent.succeeded')      status = 'success';
    else if (eventType === 'payment_intent.payment_failed') status = 'failed';
    else if (eventType === 'charge.refunded')               status = 'refunded';

    return {
      eventId          : body?.id || `${eventType}:${intent.id}`,
      eventType,
      status,
      providerOrderId  : intent.payment_intent || intent.id || null,
      providerPaymentId: intent.latest_charge || intent.id || null,
      failureReason    : intent.last_payment_error?.message || null,
    };
  }
}

module.exports = { StripeProvider };

