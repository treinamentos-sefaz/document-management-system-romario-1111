const { randomUUID } = require('node:crypto');
const documentRepository = require('../repositories/documentRepository');
const fileStorageRepository = require('../repositories/fileStorageRepository');

function createError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function toPublicDocument(document) {
  const { storageName, ...publicDocument } = document;
  return publicDocument;
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
    documentRepository.save(document);
  } catch (error) {
    await fileStorageRepository.remove(file.filename);
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