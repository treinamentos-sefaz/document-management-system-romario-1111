const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');
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

  const ownerListResponse = await fetch(`${baseUrl}/documents`, {
    headers: { 'X-User-Id': 'user-a' },
  });
  const ownerList = await ownerListResponse.json();
  assert.equal(ownerListResponse.status, 200);
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
