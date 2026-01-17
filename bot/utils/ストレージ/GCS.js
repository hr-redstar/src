const { Storage } = require('@google-cloud/storage');

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET_NAME;
const prefix = process.env.GCS_PREFIX || 'GCS';

function objectPath(guildId) {
  return `${prefix}/${guildId}/config.json`;
}

async function downloadConfig(guildId) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath(guildId));
  const [exists] = await file.exists();
  if (!exists) return null;

  const [buf] = await file.download();
  return JSON.parse(buf.toString('utf8'));
}

async function uploadConfig(guildId, config) {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath(guildId));
  const data = Buffer.from(JSON.stringify(config, null, 2), 'utf8');
  await file.save(data, {
    contentType: 'application/json',
    resumable: false,
    metadata: { cacheControl: 'no-store' },
  });
}

module.exports = { downloadConfig, uploadConfig };
