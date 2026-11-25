'use strict';

require('./setup');

const Joi = require('joi');
const validate = require('../src/middleware/validate');
const {
  authorize,
  requirePermission,
  requireAnyPermission,
  requireOwnerOrAdmin,
} = require('../src/middleware/authorize');
const { errorHandler, notFound } = require('../src/middleware/errorHandler');
const catchAsync = require('../src/utils/catchAsync');
const AppError = require('../src/utils/AppError');
const { PERMISSIONS } = require('../src/config/permissions');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Validate Middleware', () => {
  const schema = Joi.object({ name: Joi.string().required(), age: Joi.number().min(1) });
  const mockNext = jest.fn();
  const mockReq = (body) => ({ body });

  beforeEach(() => mockNext.mockClear());

  test('passes valid body through', () => {
    validate(schema)(mockReq({ name: 'Alice', age: 20 }), mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('strips unknown fields', () => {
    const req = mockReq({ name: 'Bob', unknownField: 'drop me' });
    validate(schema)(req, mockRes(), mockNext);
    expect(req.body).not.toHaveProperty('unknownField');
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('calls next with AppError 422 on invalid body', () => {
    validate(schema)(mockReq({ age: -1 }), mockRes(), mockNext);
    const arg = mockNext.mock.calls[0][0];
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(422);
    expect(Array.isArray(arg.details)).toBe(true);
  });
});

describe('Authorization & Permission Middleware', () => {
  const makeReq = (role, id = '123') => ({ user: { id, role } });
  const mockNext = jest.fn();

  beforeEach(() => mockNext.mockClear());

  test('authorize allows user with correct role', () => {
    authorize('admin')(makeReq('admin'), mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('authorize denies user with wrong role', () => {
    authorize('admin')(makeReq('student'), mockRes(), mockNext);
    const arg = mockNext.mock.calls[0][0];
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(403);
  });

  test('authorize allows any of multiple roles', () => {
    authorize('admin', 'faculty')(makeReq('faculty'), mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('authorize returns 401 when no user attached', () => {
    authorize('admin')({}, mockRes(), mockNext);
    const arg = mockNext.mock.calls[0][0];
    expect(arg.statusCode).toBe(401);
  });

  test('requirePermission grants faculty permission to mark attendance', () => {
    requirePermission(PERMISSIONS.ATTENDANCE_MARK)(makeReq('faculty'), mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('requirePermission denies student permission to mark attendance', () => {
    requirePermission(PERMISSIONS.ATTENDANCE_MARK)(makeReq('student'), mockRes(), mockNext);
    const arg = mockNext.mock.calls[0][0];
    expect(arg).toBeInstanceOf(AppError);
    expect(arg.statusCode).toBe(403);
  });

  test('requireAnyPermission allows if at least one permission matches', () => {
    requireAnyPermission(PERMISSIONS.FEES_MANAGE, PERMISSIONS.FEES_READ_OWN)(
      makeReq('student'),
      mockRes(),
      mockNext
    );
    expect(mockNext).toHaveBeenCalledWith();
  });

  test('requireOwnerOrAdmin permits owner and admin, denies others', () => {
    requireOwnerOrAdmin((req) => req.targetOwnerId)(
      { user: { id: 'u1', role: 'student' }, targetOwnerId: 'u1' },
      mockRes(),
      mockNext
    );
    expect(mockNext).toHaveBeenCalledWith();

    mockNext.mockClear();
    requireOwnerOrAdmin((req) => req.targetOwnerId)(
      { user: { id: 'u2', role: 'student' }, targetOwnerId: 'u1' },
      mockRes(),
      mockNext
    );
    expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
  });
});

describe('Error Handling & catchAsync Middleware', () => {
  test('notFound forwards 404 AppError', () => {
    const next = jest.fn();
    notFound({ method: 'GET', originalUrl: '/api/v1/missing' }, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });

  test('errorHandler maps CastError, 11000, ValidationError, JWT errors, and JSON SyntaxError', () => {
    const req = { path: '/test', method: 'POST' };

    const resCast = mockRes();
    errorHandler({ name: 'CastError', path: 'id', value: 'bad' }, req, resCast, jest.fn());
    expect(resCast.status).toHaveBeenCalledWith(400);

    const resDup = mockRes();
    errorHandler({ code: 11000, keyValue: { email: 'a@b.com' } }, req, resDup, jest.fn());
    expect(resDup.status).toHaveBeenCalledWith(409);

    const resVal = mockRes();
    errorHandler(
      { name: 'ValidationError', errors: { email: { path: 'email', message: 'Invalid' } } },
      req,
      resVal,
      jest.fn()
    );
    expect(resVal.status).toHaveBeenCalledWith(422);

    const resJwt = mockRes();
    errorHandler({ name: 'TokenExpiredError' }, req, resJwt, jest.fn());
    expect(resJwt.status).toHaveBeenCalledWith(401);

    const resJson = mockRes();
    const syntaxErr = new SyntaxError('Unexpected token');
    syntaxErr.type = 'entity.parse.failed';
    errorHandler(syntaxErr, req, resJson, jest.fn());
    expect(resJson.status).toHaveBeenCalledWith(400);
  });

  test('catchAsync forwards async rejections to next', async () => {
    const next = jest.fn();
    const handler = catchAsync(async () => {
      throw new AppError('boom', 418);
    });
    await handler({}, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 418 }));
  });
});
