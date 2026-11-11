const multer = require('multer');

function errorController(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    const statusCode = tooLarge ? 413 : 400;
    const code = tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_FILE';
    const message = tooLarge
      ? 'O arquivo excede o limite permitido.'
      : 'Envie somente um arquivo no campo file.';

    return res.status(statusCode).json({ error: { code, message } });
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = error.code || 'INTERNAL_SERVER_ERROR';
  const message = statusCode === 500 ? 'Erro interno do servidor.' : error.message;

  return res.status(statusCode).json({ error: { code, message } });
}

module.exports = errorController;