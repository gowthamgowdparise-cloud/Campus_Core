'use strict';

const Announcement     = require('./announcement.model');
const Student          = require('../students/student.model');
const Faculty          = require('../faculty/faculty.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const AppError         = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');

const listAnnouncements = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.type)                filter.type = query.type;
  if (query.priority)            filter.priority = query.priority;
  if (query.isPinned !== undefined) filter.isPinned = query.isPinned;

  if (caller.role === 'admin') {
    if (query.isActive !== undefined) filter.isActive = query.isActive;
  } else {
    const now = new Date();
    filter.isActive    = true;
    filter.publishAt   = { $lte: now };
    filter.targetRoles = { $in: ['all', caller.role] };
    filter.$and = [
      { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
    ];

    if (caller.role === 'student' && caller.studentProfile) {
      const stu = await Student.findById(caller.studentProfile).select('department program currentSection');
      if (stu) {
        filter.$and.push({
          $or: [{ targetDepartments: { $size: 0 } }, { targetDepartments: stu.department }],
        });
        filter.$and.push({
          $or: [{ targetPrograms: { $size: 0 } }, { targetPrograms: stu.program }],
        });
        if (stu.currentSection) {
          filter.$and.push({
            $or: [{ targetSections: { $size: 0 } }, { targetSections: stu.currentSection }],
          });
        }
      }
    } else if (caller.role === 'faculty' && caller.facultyProfile) {
      const fac = await Faculty.findById(caller.facultyProfile).select('department');
      if (fac) {
        filter.$and.push({
          $or: [
            { targetDepartments: { $size: 0 } },
            { targetDepartments: fac.department },
            { createdBy: caller.id },
          ],
        });
      }
    }
  }

  const searchFilter = buildSearchFilter(query.search, ['title', 'content']);
  if (searchFilter) {
    filter.$and = [...(filter.$and || []), searchFilter];
  }

  const [announcements, total] = await Promise.all([
    Announcement.find(filter)
      .populate('createdBy', 'firstName lastName role')
      .sort({ isPinned: -1, publishAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter),
  ]);

  return { announcements, meta: buildPaginationMeta({ page, limit, total }) };
};

const createAnnouncement = async (payload, caller) => {
  if (caller.role === 'faculty') {
    // Faculty can only make course/section-scoped announcements targeting students
    const hasRestrictedRole = payload.targetRoles.some((r) => r === 'all' || r === 'admin');
    if (hasRestrictedRole) {
      throw new AppError('Faculty announcements must target students (and/or faculty) for assigned sections.', 403);
    }
    if (!payload.targetSections || payload.targetSections.length === 0) {
      throw new AppError('Faculty announcements must specify targetSections assigned to you.', 400);
    }
    const assignedSections = await CourseAssignment.find({
      faculty : caller.facultyProfile,
      isActive: true,
    }).distinct('section');
    const allowedSet = new Set(assignedSections.map(String));
    const unauthorized = payload.targetSections.filter((s) => !allowedSet.has(String(s)));
    if (unauthorized.length > 0) {
      throw new AppError('You can only post announcements for sections assigned to you.', 403);
    }
  }

  return Announcement.create({ ...payload, createdBy: caller.id });
};

const updateAnnouncement = async (id, payload, caller) => {
  const doc = await Announcement.findById(id);
  if (!doc) throw new AppError('Announcement not found', 404);

  if (caller.role !== 'admin' && String(doc.createdBy) !== caller.id) {
    throw new AppError('You can only update announcements you created.', 403);
  }

  Object.assign(doc, payload);
  await doc.save();
  return doc;
};

const deleteAnnouncement = async (id, caller) => {
  const doc = await Announcement.findById(id);
  if (!doc) throw new AppError('Announcement not found', 404);

  if (caller.role !== 'admin' && String(doc.createdBy) !== caller.id) {
    throw new AppError('You can only delete announcements you created.', 403);
  }

  doc.isDeleted = true;
  doc.deletedAt = new Date();
  doc.deletedBy = caller.id;
  doc.isActive  = false;
  await doc.save();
};

module.exports = {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};

