'use strict';

require('./setup');

const { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } = require('../src/modules/auth/auth.tokens');
const mongoose = require('mongoose');

const fakeUserId = new mongoose.Types.ObjectId();

describe('JWT Token Utilities', () => {
  describe('generateAccessToken / verifyAccessToken', () => {
    test('should generate and verify a valid access token', () => {
      const token   = generateAccessToken({ userId: fakeUserId, role: 'admin' });
      const decoded = verifyAccessToken(token);
      expect(decoded.sub).toBe(fakeUserId.toString());
      expect(decoded.role).toBe('admin');
      expect(decoded.type).toBe('access');
    });

    test('should fail when verified with wrong secret (refresh secret)', () => {
      const token = generateAccessToken({ userId: fakeUserId, role: 'student' });
      expect(() => {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      }).toThrow();
    });
  });

  describe('generateRefreshToken / verifyRefreshToken', () => {
    test('should generate a refresh token with family and expiresAt', () => {
      const { token, family, expiresAt } = generateRefreshToken({ userId: fakeUserId, role: 'faculty' });
      expect(typeof token).toBe('string');
      expect(typeof family).toBe('string');
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('should reuse the same family when provided', () => {
      const { family: f1 } = generateRefreshToken({ userId: fakeUserId, role: 'admin' });
      const { family: f2 } = generateRefreshToken({ userId: fakeUserId, role: 'admin', family: f1 });
      expect(f1).toBe(f2);
    });

    test('should verify refresh token correctly', () => {
      const { token } = generateRefreshToken({ userId: fakeUserId, role: 'student' });
      const decoded   = verifyRefreshToken(token);
      expect(decoded.sub).toBe(fakeUserId.toString());
      expect(decoded.type).toBe('refresh');
    });
  });
});

