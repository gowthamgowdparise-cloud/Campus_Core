'use strict';

const Grievance    = require('./grievance.model');
const Faculty      = require('../faculty/faculty.model');
const User         = require('../users/user.model');
const Notification = require('../notifications/notification.model');
const AppError     = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');

const sanitizeGrievanceForCaller = (doc, callerRole) => {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  if (callerRole === 'student' && Array.isArray(obj.comments)) {
    obj.comments = obj.comments.filter((c) => !c.isInternal);
  }
  return obj;
};

const listGrievances = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.category)   filter.category = query.category;
  if (query.priority)   filter.priority = query.priority;
  if (query.status)     filter.status = query.status;
  if (query.department) filter.department = query.department;

  if (caller.role === 'student') {
    filter.raisedBy = caller.id;
  } else if (caller.role === 'faculty') {
    const fac = await Faculty.findById(caller.facultyProfile).select('department');
    filter.$or = [
      { raisedBy: caller.id },
      { assignedTo: caller.id },
      ...(fac?.department ? [{ department: fac.department }] : []),
    ];
  }

  const searchFilter = buildSearchFilter(query.search, ['ticketNumber', 'subject', 'description']);
  if (searchFilter) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  const [docs, total] = await Promise.all([
    Grievance.find(filter)
      .populate('raisedBy', 'firstName lastName email role')
      .populate('assignedTo', 'firstName lastName email role')
      .populate('department', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Grievance.countDocuments(filter),
  ]);

  const grievances = docs.map((d) => sanitizeGrievanceForCaller(d, caller.role));
  return { grievances, meta: buildPaginationMeta({ page, limit, total }) };
};

const assertGrievanceAccess = async (grievance, caller) => {
  if (caller.role === 'admin') return;
  if (String(grievance.raisedBy._id || grievance.raisedBy) === caller.id) return;
  if (grievance.assignedTo && String(grievance.assignedTo._id || grievance.assignedTo) === caller.id) return;

  if (caller.role === 'faculty' && grievance.department) {
    const fac = await Faculty.findById(caller.facultyProfile).select('department');
    if (fac && String(fac.department) === String(grievance.department._id || grievance.department)) return;
  }

  throw new AppError('You do not have permission to access this grievance.', 403);
};

const getGrievanceById = async (id, caller) => {
  const doc = await Grievance.findById(id)
    .populate('raisedBy', 'firstName lastName email role')
    .populate('assignedTo', 'firstName lastName email role')
    .populate('department', 'name code')
    .populate('comments.author', 'firstName lastName role');

  if (!doc) throw new AppError('Grievance ticket not found', 404);
  await assertGrievanceAccess(doc, caller);
  return sanitizeGrievanceForCaller(doc, caller.role);
};

const createGrievance = async (payload, caller) => {
  return Grievance.create({
    ...payload,
    raisedBy: caller.id,
    student : caller.studentProfile || null,
  });
};

const addComment = async (id, payload, caller) => {
  const doc = await Grievance.findById(id);
  if (!doc) throw new AppError('Grievance ticket not found', 404);
  await assertGrievanceAccess(doc, caller);

  const isInternal = caller.role === 'student' ? false : Boolean(payload.isInternal);
  doc.comments.push({
    author: caller.id,
    comment: payload.comment,
    isInternal,
  });
  await doc.save();
  return sanitizeGrievanceForCaller(doc, caller.role);
};

const assignGrievance = async (id, assignedTo) => {
  const doc = await Grievance.findById(id);
  if (!doc) throw new AppError('Grievance ticket not found', 404);

  if (assignedTo) {
    const assignee = await User.findById(assignedTo);
    if (!assignee || !['admin', 'faculty'].includes(assignee.role)) {
      throw new AppError('Grievance must be assigned to an active admin or faculty user', 400);
    }
  }

  doc.assignedTo = assignedTo;
  if (assignedTo && doc.status === 'open') doc.status = 'in_progress';
  await doc.save();

  if (assignedTo) {
    await Notification.create({
      recipient : assignedTo,
      type      : 'grievance_update',
      title     : `Grievance Assigned: ${doc.ticketNumber}`,
      message   : `Ticket "${doc.subject}" has been assigned to you.`,
      entityType: 'Grievance',
      entityId  : doc._id,
      channels  : ['in_app'],
    });
  }

  return doc;
};

const updateStatus = async (id, payload, caller) => {
  const doc = await Grievance.findById(id);
  if (!doc) throw new AppError('Grievance ticket not found', 404);

  if (caller.role !== 'admin' && String(doc.assignedTo) !== caller.id) {
    throw new AppError('Only administrators or the assigned staff member can update grievance status.', 403);
  }

  doc.status = payload.status;
  if (payload.resolution !== undefined) doc.resolution = payload.resolution;
  if (payload.status === 'resolved') doc.resolvedAt = new Date();
  if (payload.status === 'closed')   doc.closedAt   = new Date();
  await doc.save();

  await Notification.create({
    recipient : doc.raisedBy,
    type      : 'grievance_update',
    title     : `Grievance ${doc.ticketNumber} Updated`,
    message   : `Status changed to "${doc.status}".`,
    entityType: 'Grievance',
    entityId  : doc._id,
    channels  : ['in_app'],
  });

  return doc;
};

module.exports = {
  listGrievances,
  getGrievanceById,
  createGrievance,
  addComment,
  assignGrievance,
  updateStatus,
};

