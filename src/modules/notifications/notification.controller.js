'use strict';

const notificationService = require('./notification.service');
const catchAsync          = require('../../utils/catchAsync');
const { sendSuccess }     = require('../../utils/apiResponse');

const getMine = catchAsync(async (req, res) => {
  const { notifications, unreadCount, meta } = await notificationService.listMyNotifications(req.user.id, req.query);
  sendSuccess(res, 200, 'Notifications retrieved successfully', { notifications, unreadCount }, meta);
});

const getUnreadCount = catchAsync(async (req, res) => {
  const data = await notificationService.getUnreadCount(req.user.id);
  sendSuccess(res, 200, 'Unread notification count retrieved', data);
});

const markRead = catchAsync(async (req, res) => {
  const doc = await notificationService.markAsRead(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Notification marked as read', doc);
});

const markAllRead = catchAsync(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user.id);
  sendSuccess(res, 200, 'All notifications marked as read', data);
});

const sendBulk = catchAsync(async (req, res) => {
  const created = await notificationService.sendNotifications(req.body);
  sendSuccess(res, 201, 'Notifications dispatched successfully', { count: created.length });
});

module.exports = { getMine, getUnreadCount, markRead, markAllRead, sendBulk };

