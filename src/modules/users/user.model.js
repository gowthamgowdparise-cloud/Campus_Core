'use strict';

const crypto   = require('crypto');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { config } = require('../../config');

const { Schema } = mongoose;

/** Deterministic SHA-256 digest so raw refresh tokens are never persisted in DB. */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

// ── Embedded: Refresh Token ──────────────────────────────────
const RefreshTokenSchema = new Schema(
  {
    token    : { type: String, required: true }, // SHA-256 digest
    family   : { type: String, required: true }, // token family for rotation
    expiresAt: { type: Date,   required: true },
    issuedAt : { type: Date,   default: Date.now },
    revokedAt: { type: Date,   default: null },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { _id: true }
);

// ── Main User Schema ─────────────────────────────────────────
const UserSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────
    firstName : { type: String, required: true, trim: true, maxlength: 50 },
    lastName  : { type: String, required: true, trim: true, maxlength: 50 },
    email     : {
      type     : String,
      required : true,
      lowercase: true,
      trim     : true,
      match    : [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    phone          : { type: String, trim: true, maxlength: 20 },
    gender         : { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    dateOfBirth    : { type: Date },
    profilePicture : { type: String }, // URL / file path

    // ── Role & Status ─────────────────────────────────────
    role  : { type: String, enum: ['admin', 'faculty', 'student'], required: true },
    status: {
      type   : String,
      enum   : ['active', 'inactive', 'suspended', 'pending_verification'],
      default: 'active',
    },

    // ── Credentials ───────────────────────────────────────
    passwordHash       : { type: String, required: true, select: false },
    mustChangePassword : { type: Boolean, default: false },
    passwordChangedAt  : { type: Date },
    tokenVersion       : { type: Number, default: 0 },
    lastLoginAt        : { type: Date },
    lastLoginIp        : { type: String },

    // ── Refresh Tokens (max 5 active devices) ─────────────
    refreshTokens: { type: [RefreshTokenSchema], default: [], select: false },

    // ── Role-specific profile references ──────────────────
    studentProfile: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    facultyProfile: { type: Schema.Types.ObjectId, ref: 'Faculty', default: null },

    // ── Soft delete ───────────────────────────────────────
    isDeleted : { type: Boolean, default: false },
    deletedAt : { type: Date,    default: null },
    deletedBy : { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────
UserSchema.index({ email: 1 },           { unique: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ isDeleted: 1 });
UserSchema.index({ studentProfile: 1 },  { sparse: true });
UserSchema.index({ facultyProfile: 1 },  { sparse: true });

// ── Virtuals ─────────────────────────────────────────────────
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// ── Pre-save: hash password ──────────────────────────────────
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(
    this.passwordHash,
    config.bcrypt.saltRounds
  );
  // Only record passwordChangedAt on subsequent password updates and rotate tokenVersion
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
    if (!this.isModified('tokenVersion')) {
      this.tokenVersion = (this.tokenVersion || 0) + 1;
    }
  }
  next();
});

// ── Instance Methods ─────────────────────────────────────────
/**
 * Verify a plain-text password against the stored hash.
 */
UserSchema.methods.verifyPassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

/**
 * Check whether a JWT was issued before the last password change.
 */
UserSchema.methods.isTokenIssuedBefore = function (jwtIssuedAt) {
  if (!this.passwordChangedAt || !jwtIssuedAt) return false;
  const changedAtSeconds = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return changedAtSeconds > jwtIssuedAt;
};

/**
 * Store a hashed refresh token, pruning expired tokens and capping active sessions at 5.
 */
UserSchema.methods.addRefreshToken = function (tokenData) {
  const MAX_DEVICES = 5;
  const now = new Date();

  // Prune expired entries first
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.expiresAt > now);

  // Enforce cap on active (unrevoked) sessions so rotations don't evict other devices
  const activeTokens = this.refreshTokens.filter((rt) => !rt.revokedAt);
  if (activeTokens.length >= MAX_DEVICES) {
    const oldestActive = activeTokens[0];
    const idx = this.refreshTokens.indexOf(oldestActive);
    if (idx !== -1) this.refreshTokens.splice(idx, 1);
  }

  this.refreshTokens.push({
    ...tokenData,
    token: hashToken(tokenData.token),
  });
};

/**
 * Find an active refresh token by raw token string.
 */
UserSchema.methods.findRefreshToken = function (token) {
  const digest = hashToken(token);
  const now = new Date();
  return this.refreshTokens.find(
    (rt) => rt.token === digest && !rt.revokedAt && rt.expiresAt > now
  );
};

/**
 * Revoke a specific refresh token family (on suspicious reuse).
 */
UserSchema.methods.revokeTokenFamily = function (family) {
  const now = new Date();
  this.refreshTokens.forEach((rt) => {
    if (rt.family === family && !rt.revokedAt) rt.revokedAt = now;
  });
};

/**
 * Revoke a single refresh token by raw token string.
 */
UserSchema.methods.revokeRefreshToken = function (token) {
  if (!token) return false;
  const digest = hashToken(token);
  const rt = this.refreshTokens.find((t) => t.token === digest && !t.revokedAt);
  if (rt) {
    rt.revokedAt = new Date();
    return true;
  }
  return false;
};

/**
 * Remove all refresh tokens (logout all devices).
 */
UserSchema.methods.revokeAllRefreshTokens = function () {
  this.refreshTokens = [];
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

// ── Default query filter: exclude soft-deleted ───────────────
UserSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const User = mongoose.model('User', UserSchema);
module.exports = User;
