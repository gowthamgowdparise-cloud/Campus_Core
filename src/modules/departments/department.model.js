'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DepartmentSchema = new Schema(
  {
    name           : { type: String, required: true, trim: true, maxlength: 120 },
    code           : { type: String, required: true, trim: true, uppercase: true, maxlength: 10 },
    description    : { type: String, trim: true },
    hod            : { type: Schema.Types.ObjectId, ref: 'Faculty', default: null },
    isActive       : { type: Boolean, default: true },
    establishedYear: { type: Number, min: 1800, max: 2100 },
    website        : { type: String, trim: true },
    email          : {
      type     : String,
      trim     : true,
      lowercase: true,
      match    : [/^\S+@\S+\.\S+$/, 'Please provide a valid department email'],
    },

    // Soft delete
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

DepartmentSchema.index({ name: 1 }, { unique: true });
DepartmentSchema.index({ code: 1 }, { unique: true });
DepartmentSchema.index({ isActive: 1 });
DepartmentSchema.index({ isDeleted: 1 });

DepartmentSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Department = mongoose.model('Department', DepartmentSchema);
module.exports = Department;
