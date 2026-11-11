import { useEffect, useState } from 'react';
import { downloadDocument, listDocuments, uploadDocument } from './services/documents.js';

const userId = import.meta.env.VITE_DMS_USER_ID?.trim() || 'local-user';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refreshDocuments() {
    setError('');
    try {
      setDocuments(await listDocuments(userId));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshDocuments();
  }, []);

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) return;
    const form = event.currentTarget;

    setIsUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadDocument(selectedFile, userId);
      setSelectedFile(null);
      form.reset();
      setNotice('Documento enviado com sucesso.');
      await refreshDocuments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDownload(document) {
    setDownloadingId(document.id);
    setError('');
    try {
      await downloadDocument(document, userId);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-name">arquivo<span>local</span></span>
        </a>
        <div className="topbar-status"><span aria-hidden="true" /> Armazenamento local</div>
      </header>

      <main className="workspace">
        <section className="page-intro" aria-labelledby="page-title">
          <p className="eyebrow">DOCUMENT MANAGEMENT SYSTEM</p>
          <div className="intro-row">
            <div>
              <h1 id="page-title">Seus documentos,<br />em um só lugar.</h1>
              <p className="intro-copy">Envie, organize e acesse seus arquivos com simplicidade.</p>
            </div>
            <div className="user-indicator">
              <span className="user-avatar" aria-hidden="true">{userId.slice(0, 1).toUpperCase()}</span>
              <span><small>SESSÃO LOCAL</small><strong>{userId}</strong></span>
            </div>
          </div>
        </section>

        <section className="upload-section" aria-labelledby="upload-title">
          <div className="section-marker" aria-hidden="true">01</div>
          <div className="upload-content">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ADICIONAR ARQUIVO</p>
                <h2 id="upload-title">Novo documento</h2>
              </div>
              <span className="size-note">Limite definido pelo servidor</span>
            </div>
            <form className="upload-form" onSubmit={handleUpload}>
              <label className={`file-picker${selectedFile ? ' has-file' : ''}`}>
                <span className="file-icon" aria-hidden="true">＋</span>
                <span className="file-picker-text">
                  <strong>{selectedFile ? selectedFile.name : 'Escolha um arquivo'}</strong>
                  <small>{selectedFile ? formatBytes(selectedFile.size) : 'Qualquer formato, conforme limite do servidor'}</small>
                </span>
                <span className="browse-label">Procurar</span>
                <input
                  type="file"
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] || null);
                    setError('');
                    setNotice('');
                  }}
                  aria-label="Selecionar documento para envio"
                />
              </label>
              <button className="primary-button" type="submit" disabled={!selectedFile || isUploading}>
                {isUploading ? 'Enviando...' : 'Enviar documento'}
                <span aria-hidden="true">↗</span>
              </button>
            </form>
            <p className="identity-note">Arquivos associados à sessão local <strong>{userId}</strong>. Esta identificação não é autenticação.</p>
          </div>
        </section>

        <section className="documents-section" aria-labelledby="documents-title">
          <div className="documents-heading">
            <div className="section-title-group">
              <div className="section-marker" aria-hidden="true">02</div>
              <div>
                <p className="eyebrow">BIBLIOTECA</p>
                <h2 id="documents-title">Documentos</h2>
              </div>
              {!isLoading && <span className="document-count">{documents.length}</span>}
            </div>
            <button className="refresh-button" type="button" onClick={refreshDocuments} disabled={isLoading} aria-label="Atualizar lista de documentos" title="Atualizar lista">
              <span aria-hidden="true">↻</span>
            </button>
          </div>

          {error && <p className="feedback error-feedback" role="alert">{error}</p>}
          {notice && <p className="feedback success-feedback" role="status">{notice}</p>}

          {isLoading ? (
            <div className="list-message" role="status">Carregando documentos...</div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">▤</span>
              <div><h3>Nenhum documento ainda</h3><p>Os arquivos enviados aparecerão aqui.</p></div>
            </div>
          ) : (
            <div className="document-list">
              {documents.map((document) => (
                <article className="document-row" key={document.id}>
                  <span className="document-icon" aria-hidden="true">▤</span>
                  <div className="document-name">
                    <strong title={document.originalName}>{document.originalName}</strong>
                    <span>{formatDate(document.uploadedAt)}</span>
                  </div>
                  <span className="document-size">{formatBytes(document.size)}</span>
                  <button
                    className="download-button"
                    type="button"
                    onClick={() => handleDownload(document)}
                    disabled={downloadingId === document.id}
                    aria-label={`Baixar ${document.originalName}`}
                    title="Baixar documento"
                  >
                    {downloadingId === document.id ? '...' : '↓'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="workspace-footer">
          <span>Armazenamento no dispositivo da aplicação</span>
          <span>Metadados temporários em memória</span>
        </footer>
      </main>
    </div>
  );
}
