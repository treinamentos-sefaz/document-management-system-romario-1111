const { Router } = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const documentController = require('../controllers/documentController');
const fileStorageRepository = require('../repositories/fileStorageRepository');
const config = require('../config');

let activeUploads = 0;

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fileStorageRepository.ensureDirectory()
        .then(() => callback(null, fileStorageRepository.storageDirectory), callback);
    },
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: {
    fileSize: config.uploadMaxFileSizeBytes,
    files: 1,
    fields: 0,
    parts: 1,
    fieldNameSize: 100,
  },
});

function limitConcurrentUploads(req, res, next) {
  if (activeUploads >= config.maxConcurrentUploads) {
    return res.status(503).json({
      error: { code: 'UPLOAD_CAPACITY_REACHED', message: 'O servico de upload esta ocupado.' },
    });
  }

  activeUploads += 1;
  let released = false;
  const releaseSlot = () => {
    if (released) return;
    released = true;
    activeUploads -= 1;
  };

  req.once('aborted', releaseSlot);
  res.once('finish', releaseSlot);
  res.once('close', releaseSlot);
  return next();
}

const router = Router();

router.post(
  '/upload',
  documentController.requireUser,
  limitConcurrentUploads,
  upload.single('file'),
  documentController.upload,
);
router.get('/documents', documentController.requireUser, documentController.list);
router.get('/documents/:id/download', documentController.requireUser, documentController.download);

module.exports = router;