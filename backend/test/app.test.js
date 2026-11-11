const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
const config = require('../src/config');
const documentController = require('../src/controllers/documentController');
const documentService = require('../src/services/documentService');
const fileStorageRepository = require('../src/repositories/fileStorageRepository');

test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('upload, listagem e download respeitam a identidade do usuario', async (context) => {
  await fileStorageRepository.ensureDirectory();
  const existingFiles = new Set(await fs.readdir(fileStorageRepository.storageDirectory));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const currentFiles = await fs.readdir(fileStorageRepository.storageDirectory);
    await Promise.all(currentFiles
      .filter((name) => !existingFiles.has(name))
      .map((name) => fs.unlink(path.join(fileStorageRepository.storageDirectory, name))));
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const noIdentityResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(noIdentityResponse.status, 400);

  const form = new FormData();
  form.set('file', new Blob(['document body'], { type: 'text/plain' }), 'notes.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-a' },
    body: form,
  });

  assert.equal(uploadResponse.status, 201);
  const { document } = await uploadResponse.json();
  assert.equal(document.originalName, 'notes.txt');
  assert.equal(document.owner, 'user-a');
  assert.equal(document.size, 13);
  assert.equal('storageName' in document, false);
  assert.equal(uploadResponse.headers.get('cache-control'), 'private, no-store');

  const uploadedFiles = (await fs.readdir(fileStorageRepository.storageDirectory))
    .filter((name) => !existingFiles.has(name));
  assert.equal(uploadedFiles.length, 1);
  assert.equal((await fs.stat(path.join(fileStorageRepository.storageDirectory, uploadedFiles[0]))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(fileStorageRepository.storageDirectory)).mode & 0o777, 0o700);
  const storageUsage = await fileStorageRepository.getStorageUsage();
  assert.ok(storageUsage.bytes >= document.size);

  const ownerListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  const ownerList = await ownerListResponse.json();
  assert.equal(ownerListResponse.status, 200);
  assert.equal(ownerListResponse.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(ownerList.documents.map((item) => item.id), [document.id]);

  const otherListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.deepEqual((await otherListResponse.json()).documents, []);

  const deniedDownload = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-b' },
  });
  assert.equal(deniedDownload.status, 404);

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadResponse.headers.get('cache-control'), 'private, no-store');
  assert.equal(await downloadResponse.text(), 'document body');
  assert.match(downloadResponse.headers.get('content-disposition'), /notes\.txt/);
});

test('upload exige arquivo e aplica limite de tamanho', async (context) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const missingFile = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-empty' },
    body: new FormData(),
  });
  assert.equal(missingFile.status, 400);

  const emptyForm = new FormData();
  emptyForm.set('file', new Blob([]), 'empty.txt');
  const emptyUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-empty-file' },
    body: emptyForm,
  });
  assert.equal(emptyUpload.status, 400);
  assert.equal((await emptyUpload.json()).error.code, 'INVALID_FILE');

  const fieldForm = new FormData();
  fieldForm.set('metadata', 'unexpected');
  fieldForm.set('file', new Blob(['content']), 'field.txt');
  const fieldUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-fields' },
    body: fieldForm,
  });
  assert.equal(fieldUpload.status, 400);

  const oversizedForm = new FormData();
  oversizedForm.set('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), 'large.bin');
  const oversizedUpload = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: { 'X-User-Id': 'user-large' },
    body: oversizedForm,
  });
  assert.equal(oversizedUpload.status, 413);
  assert.equal((await oversizedUpload.json()).error.code, 'FILE_TOO_LARGE');
});

test('armazenamento rejeita nomes que nao sejam UUID', () => {
  for (const storageName of ['..', '../app.js', 'nested/file', 'nested\\file']) {
    assert.throws(() => fileStorageRepository.getFilePath(storageName));
  }

  assert.match(
    fileStorageRepository.getFilePath('123e4567-e89b-42d3-a456-426614174000'),
    new RegExp(`^${fileStorageRepository.storageDirectory.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`),
  );
});

test('quota de documentos e de disco rejeita upload e remove o arquivo', async () => {
  await fileStorageRepository.ensureDirectory();
  const storageName = '123e4567-e89b-42d3-a456-426614174000';
  const filePath = fileStorageRepository.getFilePath(storageName);
  const originalMaxDocumentCount = config.maxDocumentCount;
  const originalMaxStorageBytes = config.maxStorageBytes;

  try {
    await fs.writeFile(filePath, 'quota');
    config.maxDocumentCount = 1;
    await assert.rejects(
      documentService.createDocument({
        filename: storageName,
        originalname: 'quota.txt',
        size: 5,
      }, 'quota-user'),
      (error) => error.statusCode === 507 && error.code === 'STORAGE_QUOTA_EXCEEDED',
    );
    assert.equal(await fileStorageRepository.exists(storageName), false);

    await fs.writeFile(filePath, 'quota');
    config.maxDocumentCount = originalMaxDocumentCount;
    config.maxStorageBytes = 1;
    await assert.rejects(
      documentService.createDocument({
        filename: storageName,
        originalname: 'quota.txt',
        size: 5,
      }, 'quota-user'),
      (error) => error.statusCode === 507 && error.code === 'STORAGE_QUOTA_EXCEEDED',
    );
    assert.equal(await fileStorageRepository.exists(storageName), false);
  } finally {
    config.maxDocumentCount = originalMaxDocumentCount;
    config.maxStorageBytes = originalMaxStorageBytes;
    await fileStorageRepository.remove(storageName);
  }
});

test('producao nao aceita identidade enviada pelo cliente por padrao', () => {
  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    userId: process.env.DMS_USER_ID,
    trustHeader: process.env.DMS_TRUSTED_IDENTITY_HEADER,
  };
  process.env.NODE_ENV = 'production';
  process.env.DMS_USER_ID = 'static-user-is-not-authentication';
  delete process.env.DMS_TRUSTED_IDENTITY_HEADER;

  let responseStatus;
  let responseBody;
  try {
    documentController.requireUser(
      { get: () => 'forged-user' },
      {
        status(status) {
          responseStatus = status;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      },
      () => assert.fail('nao deve aceitar identidade sem provedor em producao'),
    );
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment.nodeEnv;
    if (previousEnvironment.userId === undefined) delete process.env.DMS_USER_ID;
    else process.env.DMS_USER_ID = previousEnvironment.userId;
    if (previousEnvironment.trustHeader === undefined) delete process.env.DMS_TRUSTED_IDENTITY_HEADER;
    else process.env.DMS_TRUSTED_IDENTITY_HEADER = previousEnvironment.trustHeader;
  }

  assert.equal(responseStatus, 503);
  assert.equal(responseBody.error.code, 'IDENTITY_PROVIDER_REQUIRED');
});

test('producao aceita identidade autenticada ou cabecalho explicitamente confiavel', () => {
  const previousEnvironment = {
    nodeEnv: process.env.NODE_ENV,
    userId: process.env.DMS_USER_ID,
    trustHeader: process.env.DMS_TRUSTED_IDENTITY_HEADER,
  };
  process.env.NODE_ENV = 'production';
  delete process.env.DMS_USER_ID;
  delete process.env.DMS_TRUSTED_IDENTITY_HEADER;

  function invokeMiddleware(request) {
    let owner;
    documentController.requireUser(request, {}, () => { owner = request.userId; });
    return owner;
  }

  try {
    assert.equal(invokeMiddleware({ auth: { userId: 'authenticated-user' } }), 'authenticated-user');
    process.env.DMS_TRUSTED_IDENTITY_HEADER = 'true';
    assert.equal(invokeMiddleware({ get: () => 'proxy-user' }), 'proxy-user');
  } finally {
    if (previousEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment.nodeEnv;
    if (previousEnvironment.userId === undefined) delete process.env.DMS_USER_ID;
    else process.env.DMS_USER_ID = previousEnvironment.userId;
    if (previousEnvironment.trustHeader === undefined) delete process.env.DMS_TRUSTED_IDENTITY_HEADER;
    else process.env.DMS_TRUSTED_IDENTITY_HEADER = previousEnvironment.trustHeader;
  }
});

test('quota de documentos nao pode ser ultrapassada por uploads concorrentes', async () => {
  await fileStorageRepository.ensureDirectory();
  const fileNames = [
    '123e4567-e89b-42d3-a456-426614174001',
    '123e4567-e89b-42d3-a456-426614174002',
  ];
  const originalMaxDocumentCount = config.maxDocumentCount;
  const currentUsage = require('../src/repositories/documentRepository').getUsage();
  config.maxDocumentCount = currentUsage.count + 1;

  try {
    await Promise.all(fileNames.map((fileName) => fs.writeFile(
      fileStorageRepository.getFilePath(fileName),
      'x',
    )));

    const results = await Promise.allSettled(fileNames.map((filename) => documentService.createDocument({
      filename,
      originalname: 'concurrent.txt',
      size: 1,
    }, 'concurrent-user')));

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const rejectedIndex = results.findIndex((result) => result.status === 'rejected');
    assert.equal(results[rejectedIndex].reason.code, 'STORAGE_QUOTA_EXCEEDED');
  } finally {
    config.maxDocumentCount = originalMaxDocumentCount;
    await Promise.all(fileNames.map((fileName) => fileStorageRepository.remove(fileName)));
  }
});
