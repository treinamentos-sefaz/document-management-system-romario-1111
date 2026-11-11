const { Router } = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const documentController = require('../controllers/documentController');
const fileStorageRepository = require('../repositories/fileStorageRepository');

const maxFileSize = Number(process.env.UPLOAD_MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024);
if (!Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('UPLOAD_MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => {
      fileStorageRepository.ensureDirectory()
        .then(() => callback(null, fileStorageRepository.storageDirectory), callback);
    },
    filename: (_req, _file, callback) => callback(null, randomUUID()),
  }),
  limits: { fileSize: maxFileSize, files: 1 },
});

const router = Router();

router.post('/upload', documentController.requireUser, upload.single('file'), documentController.upload);
router.get('/documents', documentController.requireUser, documentController.list);
router.get('/documents/:id/download', documentController.requireUser, documentController.download);

module.exports = router;