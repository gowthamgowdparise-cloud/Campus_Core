'use strict';

const paymentService = require('./payment.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { payments, meta } = await paymentService.listPayments(req.query, req.user);
  sendSuccess(res, 200, 'Payments retrieved successfully', payments, meta);
});

const getMine = catchAsync(async (req, res) => {
  const { payments, meta } = await paymentService.listPayments(req.query, req.user);
  sendSuccess(res, 200, 'My payment history retrieved successfully', payments, meta);
});

const getById = catchAsync(async (req, res) => {
  const payment = await paymentService.getPaymentById(req.params.id, req.user);
  sendSuccess(res, 200, 'Payment retrieved successfully', payment);
});

const getReceipt = catchAsync(async (req, res) => {
  const receipt = await paymentService.getReceipt(req.params.id, req.user);
  sendSuccess(res, 200, 'Payment receipt retrieved successfully', receipt);
});

const create = catchAsync(async (req, res) => {
  const payment = await paymentService.recordPayment(req.body, req.user);
  sendSuccess(res, 201, 'Payment recorded successfully', payment);
});

const initiate = catchAsync(async (req, res) => {
  const result = await paymentService.initiateProviderPayment(req.body, req.user);
  sendSuccess(res, 201, 'Online payment initiated successfully', result);
});

const verify = catchAsync(async (req, res) => {
  const payment = await paymentService.verifyProviderPayment(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Payment verified successfully', payment);
});

const webhook = catchAsync(async (req, res) => {
  const result = await paymentService.processProviderWebhook(req.params.provider, req);
  sendSuccess(res, 200, 'Webhook processed', result);
});

const reconcile = catchAsync(async (req, res) => {
  const payment = await paymentService.reconcilePayment(req.params.id, req.body, req.user.id);
  sendSuccess(res, 200, 'Payment reconciled successfully', payment);
});

const reconciliationSummary = catchAsync(async (_req, res) => {
  const summary = await paymentService.getReconciliationSummary();
  sendSuccess(res, 200, 'Payment reconciliation summary retrieved', summary);
});

module.exports = {
  list,
  getMine,
  getById,
  getReceipt,
  create,
  initiate,
  verify,
  webhook,
  reconcile,
  reconciliationSummary,
};

