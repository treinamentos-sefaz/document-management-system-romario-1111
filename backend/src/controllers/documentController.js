const documentService = require('../services/documentService');

function requireUser(req, res, next) {
  const authenticatedOwner = req.auth?.userId ?? req.user?.id;
  const canTrustHeader = process.env.NODE_ENV !== 'production'
    || process.env.DMS_TRUSTED_IDENTITY_HEADER === 'true';
  const headerOwner = canTrustHeader ? req.get('X-User-Id')?.trim() : undefined;
  const owner = typeof authenticatedOwner === 'string' && authenticatedOwner.trim()
    ? authenticatedOwner.trim()
    : headerOwner;

  if (!owner) {
    const productionWithoutIdentity = process.env.NODE_ENV === 'production'
      && !canTrustHeader;
    return res.status(productionWithoutIdentity ? 503 : 400).json({
      error: {
        code: productionWithoutIdentity ? 'IDENTITY_PROVIDER_REQUIRED' : 'USER_REQUIRED',
        message: productionWithoutIdentity
          ? 'Configure um provedor de identidade antes de expor a API.'
          : 'A identidade do usuario e obrigatoria.',
      },
    });
  }

  if (owner.length > 128) {
    return res.status(400).json({
      error: { code: 'INVALID_USER_ID', message: 'A identidade do usuario e invalida.' },
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
  res.set('Cache-Control', 'private, no-store');
  return res.status(201).json({ document });
}

function list(req, res) {
  const documents = documentService.listDocuments(req.userId);
  res.set('Cache-Control', 'private, no-store');
  return res.json({ documents });
}

async function download(req, res, next) {
  const result = await documentService.getDocumentForDownload(req.params.id, req.userId);
  const downloadName = result.document.originalName
    .replace(/[\\/\u0000-\u001f\u007f]/g, '_')
    .trim() || 'document';

  res.set('Cache-Control', 'private, no-store');
  return res.download(result.filePath, downloadName, (error) => {
    if (error) {
      if (!res.headersSent && error.code === 'ENOENT') {
        return res.status(404).json({
          error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento nao encontrado.' },
        });
      }
      next(error);
    }
  });
}

module.exports = { requireUser, upload, list, download };