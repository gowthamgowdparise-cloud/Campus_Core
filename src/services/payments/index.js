'use strict';

const { config } = require('../../config');
const AppError   = require('../../utils/AppError');
const { RazorpayProvider } = require('./razorpay.provider');
const { StripeProvider }   = require('./stripe.provider');

const razorpayProvider = new RazorpayProvider();
const stripeProvider   = new StripeProvider();

const getPaymentProvider = (overrideName = null) => {
  const name = (overrideName || config.payments.provider || 'manual').toLowerCase();
  if (name === 'razorpay') return razorpayProvider;
  if (name === 'stripe')   return stripeProvider;
  if (name === 'manual') {
    throw new AppError(
      'External online payment gateway is not enabled (PAYMENT_PROVIDER=manual). Use manual reference recording or configure Razorpay/Stripe.',
      503
    );
  }
  throw new AppError(`Unsupported payment provider "${name}"`, 400);
};

module.exports = {
  getPaymentProvider,
  razorpayProvider,
  stripeProvider,
};

