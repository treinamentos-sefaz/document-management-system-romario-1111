function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

module.exports = {
  host: process.env.HOST || '127.0.0.1',
  port: (() => {
    const port = positiveInteger('PORT', 3000);
    if (port > 65535) throw new Error('PORT deve estar entre 1 e 65535.');
    return port;
  })(),
  uploadMaxFileSizeBytes: positiveInteger('UPLOAD_MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024),
  maxConcurrentUploads: positiveInteger('DMS_MAX_CONCURRENT_UPLOADS', 5),
  maxDocumentCount: positiveInteger('DMS_MAX_DOCUMENT_COUNT', 1000),
  maxStorageBytes: positiveInteger('DMS_MAX_STORAGE_BYTES', 1024 * 1024 * 1024),
};