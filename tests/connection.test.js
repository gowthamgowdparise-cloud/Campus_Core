'use strict';

require('./setup');

const mongoose = require('mongoose');
const { connectDB, disconnectDB, getDBStatus, getDatabaseUri } = require('../src/config/database');

describe('Database Configuration (Unit)', () => {
  test('resolves MONGODB_URI_TEST when NODE_ENV=test', () => {
    const uri = getDatabaseUri();
    expect(uri).toBeTruthy();
    if (process.env.MONGODB_URI_TEST) {
      expect(uri).toBe(process.env.MONGODB_URI_TEST);
    }
  });

  test('reports disconnected status cleanly before connecting', async () => {
    await disconnectDB();
    const status = getDBStatus();
    expect(status.readyState).toBe(0);
    expect(status.isConnected).toBe(false);
    expect(status.status).toBe('disconnected');
  });
});

describe('MongoDB Connection (Integration)', () => {
  beforeAll(async () => {
    await connectDB();
  }, 15000);

  afterAll(async () => {
    await disconnectDB();
  }, 15000);

  test('should connect to MongoDB successfully', () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(getDBStatus().isConnected).toBe(true);
  });

  test('should have a valid connection host', () => {
    expect(mongoose.connection.host).toBeTruthy();
  });

  test('should be using the test database', () => {
    expect(mongoose.connection.name).toContain('test');
  });
});
