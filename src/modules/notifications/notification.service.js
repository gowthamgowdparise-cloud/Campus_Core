'use strict';

const Notification = require('./notification.model');
const User         = require('../users/user.model');
const AppError     = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');

const listMyNotifications = async (userId, query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = { recipient: userId };
  if (query.isRead !== undefined) filter.isRead = query.isRead;
  if (query.type)                 filter.type = query.type;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return { notifications, unreadCount, meta: buildPaginationMeta({ page, limit, total }) };
};

const getUnreadCount = async (userId) => {
  const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });
  return { unreadCount };
};

const markAsRead = async (notificationId, userId) => {
  const doc = await Notification.findOne({ _id: notificationId, recipient: userId });
  if (!doc) throw new AppError('Notification not found', 404);

  if (!doc.isRead) {
    doc.isRead = true;
    doc.readAt = new Date();
    await doc.save();
  }
  return doc;
};

const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return { modifiedCount: result.modifiedCount };
};

const sendNotifications = async (payload) => {
  const uniqueIds = Array.from(new Set(payload.recipients.map(String)));
  const validUsers = await User.find({ _id: { $in: uniqueIds } }).distinct('_id');
  if (validUsers.length === 0) throw new AppError('No valid recipient users found', 404);

  const docs = validUsers.map((uid) => ({
    recipient: uid,
    type     : payload.type,
    title    : payload.title,
    message  : payload.message,
    priority : payload.priority,
    channels : payload.channels,
    expiresAt: payload.expiresAt,
  }));

  return Notification.insertMany(docs);
};

module.exports = {
  listMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  sendNotifications,
};

