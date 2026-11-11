const documentService = require('../services/documentService');

function requireUser(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner) {
    return res.status(400).json({
      error: { code: 'USER_REQUIRED', message: 'O cabecalho X-User-Id e obrigatorio.' },
    });
  }

  req.userId = owner;
  return next();
}

async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({
      error: { code: 'FILE_REQUIRED', message: 'Envie um arquivo no campo file.' },
    });
  }

  const document = await documentService.createDocument(req.file, req.userId);
  return res.status(201).json({ document });
}

function list(req, res) {
  const documents = documentService.listDocuments(req.userId);
  return res.json({ documents });
}

async function download(req, res, next) {
  const result = await documentService.getDocumentForDownload(req.params.id, req.userId);
  const downloadName = result.document.originalName
    .replace(/[\\/\r\n]/g, '_')
    .trim() || 'document';

  return res.download(result.filePath, downloadName, (error) => {
    if (error) {
      next(error);
    }
  });
}

module.exports = { requireUser, upload, list, download };