'use strict';

require('./setup');

const mongoose = require('mongoose');
const AppError = require('../src/utils/AppError');
const { sendSuccess, sendError, buildPaginationMeta } = require('../src/utils/apiResponse');
const { validateConfig } = require('../src/config');
const { runInTransaction } = require('../src/utils/transaction');

describe('AppError', () => {
  test('should create a 404 operational error', () => {
    const err = new AppError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('fail');
    expect(err.isOperational).toBe(true);
  });

  test('should create a 500 server error', () => {
    const err = new AppError('Server error', 500);
    expect(err.status).toBe('error');
  });

  test('should carry details', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const err = new AppError('Validation failed', 422, details);
    expect(err.details).toEqual(details);
  });
});

describe('API Response helpers', () => {
  const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
  };

  test('sendSuccess – 200 with data', () => {
    const res = mockRes();
    sendSuccess(res, 200, 'OK', { id: '1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', message: 'OK', data: { id: '1' } })
    );
  });

  test('sendSuccess – omits data key when data is null', () => {
    const res = mockRes();
    sendSuccess(res, 200, 'No data');
    const body = res.json.mock.calls[0][0];
    expect(body).not.toHaveProperty('data');
  });

  test('sendError – 400', () => {
    const res = mockRes();
    sendError(res, 400, 'Bad request');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fail', message: 'Bad request' })
    );
  });

  test('buildPaginationMeta handles valid values and zero limit safely', () => {
    const meta = buildPaginationMeta({ page: 2, limit: 10, total: 55 });
    expect(meta.totalPages).toBe(6);
    expect(meta.page).toBe(2);

    const safeMeta = buildPaginationMeta({ page: 0, limit: 0, total: 10 });
    expect(safeMeta.page).toBe(1);
    expect(safeMeta.limit).toBe(20);
    expect(safeMeta.totalPages).toBe(1);
  });
});

describe('Config Validation', () => {
  test('validateConfig passes with valid test configuration', () => {
    expect(() => validateConfig()).not.toThrow();
  });

  test('validateConfig throws if access and refresh secrets are identical', () => {
    const original = process.env.JWT_REFRESH_SECRET;
    process.env.JWT_REFRESH_SECRET = process.env.JWT_ACCESS_SECRET;
    try {
      expect(() => validateConfig()).toThrow('must be different');
    } finally {
      process.env.JWT_REFRESH_SECRET = original;
    }
  });
});

describe('Transaction Utility (Unit)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('commits work inside session.withTransaction and ends session', async () => {
    const endSession = jest.fn().mockResolvedValue();
    const withTransaction = jest.fn(async (fn) => fn());
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({ withTransaction, endSession });

    const out = await runInTransaction(async (session) => {
      expect(session).toBeDefined();
      return { ok: true };
    });

    expect(out).toEqual({ ok: true });
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(endSession).toHaveBeenCalledTimes(1);
  });

  test('ends session and rethrows if transaction fails', async () => {
    const endSession = jest.fn().mockResolvedValue();
    const withTransaction = jest.fn(async () => {
      throw new Error('tx write conflict');
    });
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({ withTransaction, endSession });

    await expect(runInTransaction(async () => {})).rejects.toThrow('tx write conflict');
    expect(endSession).toHaveBeenCalledTimes(1);
  });
});
