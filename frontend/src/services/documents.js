const API_BASE = '/api';

async function readError(response) {
  try {
    const body = await response.json();
    return body.error?.message || 'Não foi possível concluir a operação.';
  } catch {
    return 'Não foi possível concluir a operação.';
  }
}

async function request(path, userId, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      'X-User-Id': userId,
    },
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response;
}

export async function listDocuments(userId) {
  const response = await request('/documents', userId);
  const body = await response.json();
  return body.documents;
}

export async function uploadDocument(file, userId) {
  const formData = new FormData();
  formData.set('file', file);
  const response = await request('/upload', userId, {
    method: 'POST',
    body: formData,
  });
  const body = await response.json();
  return body.document;
}

export async function downloadDocument(document, userId) {
  const response = await request(
    `/documents/${encodeURIComponent(document.id)}/download`,
    userId,
  );
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = document.originalName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}