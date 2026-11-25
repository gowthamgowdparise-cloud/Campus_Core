'use strict';

const Document         = require('./document.model');
const Student          = require('../students/student.model');
const Enrollment       = require('../enrollments/enrollment.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const Notification     = require('../notifications/notification.model');
const AppError         = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');
const { generateStorageKey } = require('../../middleware/upload');
const { getStorageProvider } = require('../../services/storage');

const getFacultyStudentIds = async (facultyProfileId) => {
  const assignments = await CourseAssignment.find({ faculty: facultyProfileId, isActive: true })
    .select('course section semester')
    .lean();
  if (assignments.length === 0) return [];
  return Enrollment.find({
    $or: assignments.map((a) => ({ course: a.course, section: a.section, semester: a.semester })),
  }).distinct('student');
};

const listDocuments = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.type)                 filter.type = query.type;
  if (query.status)               filter.status = query.status;
  if (query.isVerified !== undefined) filter.isVerified = query.isVerified;

  if (caller.role === 'student') {
    filter.$or = [
      { owner: caller.id },
      { student: caller.studentProfile },
      { isPublic: true },
    ];
  } else if (caller.role === 'faculty') {
    const stuIds = await getFacultyStudentIds(caller.facultyProfile);
    filter.$or = [
      { owner: caller.id },
      { uploadedBy: caller.id },
      { isPublic: true },
      ...(stuIds.length > 0 ? [{ student: { $in: stuIds } }] : []),
    ];
  } else if (query.student) {
    filter.student = query.student;
  }

  const searchFilter = buildSearchFilter(query.search, ['title', 'fileName']);
  if (searchFilter) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  const [documents, total] = await Promise.all([
    Document.find(filter)
      .populate('owner', 'firstName lastName email role')
      .populate('student', 'rollNumber enrollmentNumber')
      .populate('verifiedBy', 'firstName lastName role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Document.countDocuments(filter),
  ]);

  return { documents, meta: buildPaginationMeta({ page, limit, total }) };
};

const getDocumentById = async (id, caller) => {
  const doc = await Document.findById(id)
    .populate('owner', 'firstName lastName email role')
    .populate('student', 'rollNumber enrollmentNumber')
    .populate('verifiedBy', 'firstName lastName role');
  if (!doc) throw new AppError('Document not found', 404);

  if (caller.role === 'admin' || doc.isPublic || String(doc.owner._id) === caller.id) {
    return doc;
  }

  if (caller.role === 'student' && doc.student && String(doc.student._id) === String(caller.studentProfile)) {
    return doc;
  }

  if (caller.role === 'faculty' && doc.student) {
    const stuIds = await getFacultyStudentIds(caller.facultyProfile);
    if (stuIds.map(String).includes(String(doc.student._id))) return doc;
  }

  throw new AppError('You do not have permission to access this document.', 403);
};

const createDocument = async (payload, uploadedFile, caller) => {
  if (!uploadedFile) {
    throw new AppError('A valid file upload in multipart field "file" is required.', 400);
  }

  const ownerId   = caller.role === 'admin' && payload.owner ? payload.owner : caller.id;
  let   studentId = caller.role === 'student' ? caller.studentProfile : (payload.student || null);

  if (caller.role === 'admin' && payload.student) {
    const stu = await Student.findById(payload.student).select('user');
    if (!stu) throw new AppError('Referenced student not found', 404);
    studentId = stu._id;
  }

  const storageProvider = getStorageProvider();
  const storageKey      = generateStorageKey('documents', ownerId, uploadedFile.ext);
  const stored          = await storageProvider.putObject({
    key        : storageKey,
    buffer     : uploadedFile.buffer,
    contentType: uploadedFile.mimeType,
    metadata   : { ownerId: String(ownerId), uploadedBy: String(caller.id) },
  });

  try {
    const doc = await Document.create({
      title          : payload.title,
      type           : payload.type,
      owner          : ownerId,
      student        : studentId,
      fileName       : uploadedFile.cleanName,
      filePath       : stored.location,
      storageProvider: stored.provider,
      storageKey     : stored.key,
      fileSize       : uploadedFile.size,
      mimeType       : uploadedFile.mimeType,
      fileHash       : uploadedFile.fileHash,
      expiresAt      : payload.expiresAt,
      isPublic       : caller.role === 'admin' ? Boolean(payload.isPublic) : false,
      uploadedBy     : caller.id,
      status         : 'uploaded',
      isVerified     : false,
    });

    if (studentId) {
      await Student.updateOne({ _id: studentId }, { $addToSet: { documents: doc._id } });
    }

    return doc;
  } catch (err) {
    await storageProvider.deleteObject(stored.key).catch(() => {});
    throw err;
  }
};

const downloadDocument = async (id, caller) => {
  const doc = await getDocumentById(id, caller);
  if (!doc.storageKey || doc.storageProvider === 'external') {
    throw new AppError('Document has no managed binary file stored', 404);
  }

  const provider = getStorageProvider(doc.storageProvider);
  if (provider.providerName === 's3') {
    const signed = await provider.getSignedDownloadUrl(doc.storageKey, { downloadName: doc.fileName });
    return { ...signed, fileName: doc.fileName, mimeType: doc.mimeType };
  }

  const streamObj = await provider.getObjectStream(doc.storageKey);
  return { ...streamObj, fileName: doc.fileName, mimeType: doc.mimeType };
};

const verifyDocument = async (id, payload, callerId) => {
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  doc.isVerified      = payload.decision === 'verified';
  doc.status          = payload.decision;
  doc.verifiedBy      = callerId;
  doc.verifiedAt      = new Date();
  doc.rejectionReason = payload.decision === 'rejected' ? payload.rejectionReason : undefined;
  await doc.save();

  await Notification.create({
    recipient : doc.owner,
    type      : 'document_verified',
    title     : `Document ${payload.decision.toUpperCase()}`,
    message   : `Document "${doc.title}" was marked ${payload.decision}.`,
    entityType: 'Document',
    entityId  : doc._id,
    channels  : ['in_app'],
  });

  return doc;
};

const deleteDocument = async (id, caller) => {
  const doc = await Document.findById(id);
  if (!doc) throw new AppError('Document not found', 404);

  if (caller.role !== 'admin') {
    if (String(doc.owner) !== caller.id) {
      throw new AppError('You can only delete your own documents.', 403);
    }
    if (doc.isVerified) {
      throw new AppError('Verified documents cannot be deleted by students/faculty.', 403);
    }
  }

  doc.isDeleted = true;
  doc.deletedAt = new Date();
  doc.deletedBy = caller.id;
  await doc.save();

  if (doc.storageKey && doc.storageProvider !== 'external') {
    await getStorageProvider(doc.storageProvider).deleteObject(doc.storageKey).catch(() => {});
  }
};

module.exports = {
  listDocuments,
  getDocumentById,
  createDocument,
  downloadDocument,
  verifyDocument,
  deleteDocument,
};
