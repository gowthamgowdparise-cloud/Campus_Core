'use strict';

const announcementService = require('./announcement.service');
const catchAsync          = require('../../utils/catchAsync');
const { sendSuccess }     = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { announcements, meta } = await announcementService.listAnnouncements(req.query, req.user);
  sendSuccess(res, 200, 'Announcements retrieved successfully', announcements, meta);
});

const create = catchAsync(async (req, res) => {
  const data = await announcementService.createAnnouncement(req.body, req.user);
  sendSuccess(res, 201, 'Announcement created successfully', data);
});

const update = catchAsync(async (req, res) => {
  const data = await announcementService.updateAnnouncement(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Announcement updated successfully', data);
});

const remove = catchAsync(async (req, res) => {
  await announcementService.deleteAnnouncement(req.params.id, req.user);
  sendSuccess(res, 200, 'Announcement deleted successfully');
});

module.exports = { list, create, update, remove };

