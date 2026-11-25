'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { config } = require('../../config');
const AppError   = require('../../utils/AppError');

class S3StorageProvider {
  constructor() {
    this.providerName = 's3';
    this._client      = null;
  }

  assertConfigured() {
    const { s3Bucket, s3Region, s3AccessKeyId, s3SecretAccessKey } = config.storage;
    if (!s3Bucket || !s3Region || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new AppError(
        'S3 object storage is not configured. Provide S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.',
        503
      );
    }
  }

  getClient() {
    this.assertConfigured();
    if (!this._client) {
      const clientCfg = {
        region     : config.storage.s3Region,
        credentials: {
          accessKeyId    : config.storage.s3AccessKeyId,
          secretAccessKey: config.storage.s3SecretAccessKey,
        },
        forcePathStyle: config.storage.s3ForcePathStyle,
      };
      if (config.storage.s3Endpoint) {
        clientCfg.endpoint = config.storage.s3Endpoint;
      }
      this._client = new S3Client(clientCfg);
    }
    return this._client;
  }

  async putObject({ key, buffer, contentType, metadata = {} }) {
    const cleanKey = String(key || '').replace(/^\/+/, '');
    if (!cleanKey || cleanKey.includes('..')) {
      throw new AppError('Invalid storage key', 400);
    }
    const client = this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket     : config.storage.s3Bucket,
        Key        : cleanKey,
        Body       : buffer,
        ContentType: contentType || 'application/octet-stream',
        Metadata   : metadata,
        ACL        : 'private',
      })
    );
    return {
      provider: this.providerName,
      key     : cleanKey,
      location: `s3://${config.storage.s3Bucket}/${cleanKey}`,
    };
  }

  async getSignedDownloadUrl(key, { expiresIn = config.storage.signedUrlTtlSec, downloadName } = {}) {
    const client = this.getClient();
    const safeName = (downloadName || 'download').replace(/["\\\r\n]/g, '_');
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket                    : config.storage.s3Bucket,
        Key                       : key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
      { expiresIn }
    );
    return {
      mode     : 'presigned_url',
      url,
      expiresIn,
    };
  }

  async deleteObject(key) {
    if (!key) return;
    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.storage.s3Bucket,
        Key   : key,
      })
    );
  }
}

module.exports = { S3StorageProvider };

