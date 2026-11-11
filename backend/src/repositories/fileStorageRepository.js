const fs = require('node:fs/promises');
const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const storageNamePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getFilePath(storageName) {
  if (!storageNamePattern.test(storageName || '')) {
    throw new Error('Nome de armazenamento invalido');
  }

  const filePath = path.resolve(storageDirectory, storageName);
  if (path.dirname(filePath) !== storageDirectory) {
    throw new Error('Nome de armazenamento invalido');
  }
  return filePath;
}

async function ensureDirectory() {
  await fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 });
  await fs.chmod(storageDirectory, 0o700);
}

async function restrictFilePermissions(storageName) {
  await fs.chmod(getFilePath(storageName), 0o600);
}

async function getStorageUsage() {
  const fileNames = await fs.readdir(storageDirectory);
  const usage = { count: 0, bytes: 0 };

  for (const fileName of fileNames) {
    const fileStat = await fs.lstat(path.join(storageDirectory, fileName));
    if (fileStat.isFile()) {
      usage.count += 1;
      usage.bytes += fileStat.size;
    }
  }

  return usage;
}

async function remove(storageName) {
  try {
    await fs.unlink(getFilePath(storageName));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function exists(storageName) {
  try {
    return (await fs.stat(getFilePath(storageName))).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

module.exports = {
  storageDirectory,
  getFilePath,
  ensureDirectory,
  restrictFilePermissions,
  getStorageUsage,
  remove,
  exists,
};