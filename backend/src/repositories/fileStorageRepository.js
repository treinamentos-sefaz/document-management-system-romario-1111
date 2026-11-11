const fs = require('node:fs/promises');
const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');

function getFilePath(storageName) {
  if (!storageName || path.basename(storageName) !== storageName) {
    throw new Error('Nome de armazenamento invalido');
  }

  return path.join(storageDirectory, storageName);
}

async function ensureDirectory() {
  await fs.mkdir(storageDirectory, { recursive: true });
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

module.exports = { storageDirectory, getFilePath, ensureDirectory, remove, exists };