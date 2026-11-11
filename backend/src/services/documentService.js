const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');
const fileStorageRepository = require('../repositories/fileStorageRepository');
const config = require('../config');

function createError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.safeToExpose = true;
  return error;
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
  };
}

async function createDocument(file, owner) {
  if (!file || file.size === 0) {
    if (file) {
      await fileStorageRepository.remove(file.filename);
    }
    throw createError(400, 'INVALID_FILE', 'Envie um arquivo nao vazio.');
  }

  const document = {
    id: randomUUID(),
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    storageName: file.filename,
  };

  try {
    await fileStorageRepository.restrictFilePermissions(file.filename);

    const storageUsage = await fileStorageRepository.getStorageUsage();
    const documentUsage = documentRepository.getUsage();
    if (documentUsage.count >= config.maxDocumentCount
      || storageUsage.bytes > config.maxStorageBytes) {
      throw createError(507, 'STORAGE_QUOTA_EXCEEDED', 'O armazenamento local atingiu o limite configurado.');
    }

    documentRepository.save(document);
  } catch (error) {
    await fileStorageRepository.remove(file.filename).catch(() => {});
    throw error;
  }

  return toPublicDocument(document);
}

function listDocuments(owner) {
  return documentRepository
    .findByOwner(owner)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
    .map(toPublicDocument);
}

async function getDocumentForDownload(id, owner) {
  const document = documentRepository.findById(id);
  if (!document || document.owner !== owner) {
    throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento nao encontrado.');
  }

  if (!(await fileStorageRepository.exists(document.storageName))) {
    throw createError(404, 'DOCUMENT_NOT_FOUND', 'Documento nao encontrado.');
  }

  return {
    document: toPublicDocument(document),
    filePath: fileStorageRepository.getFilePath(document.storageName),
  };
}

module.exports = { createDocument, listDocuments, getDocumentForDownload };