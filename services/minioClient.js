const fs = require('fs');
const path = require('path');
const {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  ListObjectsV2Command,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

class MinioService {
  constructor(config = {}) {
    this.config = {
      endpoint: config.endpoint || process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: config.region || 'us-east-1',
      accessKeyId: config.accessKeyId || process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretAccessKey: config.secretAccessKey || process.env.MINIO_SECRET_KEY || 'minioadmin',
      bucket: config.bucket || process.env.MINIO_BUCKET || 'douyin-videos',
      useSSL: config.useSSL ?? false
    };

    this.initClient();
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.initClient();
  }

  initClient() {
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      },
      forcePathStyle: true // Bắt buộc cho MinIO self-hosted
    });
  }

  /**
   * Kiểm tra kết nối và tạo bucket nếu chưa có
   */
  async ensureBucket() {
    const bucket = this.config.bucket;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { status: 'exists', bucket };
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log(`[MinIO] Bucket ${bucket} chưa tồn tại, đang tạo mới...`);
        await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
        return { status: 'created', bucket };
      }
      throw err;
    }
  }

  /**
   * Upload video local lên MinIO
   */
  async uploadVideo(localFilePath, s3KeyName, mimeType = 'video/mp4') {
    await this.ensureBucket();
    const fileStream = fs.createReadStream(localFilePath);
    const fileSize = fs.statSync(localFilePath).size;

    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: s3KeyName,
      Body: fileStream,
      ContentType: mimeType,
      ContentLength: fileSize
    });

    await this.client.send(command);

    // Tạo presigned URL có hiệu lực trong 24 giờ
    const viewUrl = await this.getPresignedUrl(s3KeyName, 86400);

    return {
      success: true,
      bucket: this.config.bucket,
      key: s3KeyName,
      size: fileSize,
      url: `${this.config.endpoint}/${this.config.bucket}/${s3KeyName}`,
      presignedUrl: viewUrl
    };
  }

  /**
   * Lấy Presigned URL để xem trực tiếp
   */
  async getPresignedUrl(s3KeyName, expiresInSeconds = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: s3KeyName
    });
    return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Kiểm tra kết nối tới server MinIO
   */
  async testConnection() {
    try {
      await this.ensureBucket();
      return { success: true, message: `Kết nối MinIO thành công tới bucket "${this.config.bucket}"!` };
    } catch (err) {
      return { success: false, message: `Lỗi kết nối MinIO: ${err.message}` };
    }
  }

  /**
   * Liệt kê các file trong bucket
   */
  async listVideos() {
    try {
      await this.ensureBucket();
      const command = new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: 'videos/'
      });
      const response = await this.client.send(command);
      return response.Contents || [];
    } catch (err) {
      console.error('[MinIO] Lỗi list files:', err.message);
      return [];
    }
  }
}

module.exports = MinioService;
