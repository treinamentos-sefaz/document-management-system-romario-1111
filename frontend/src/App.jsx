import { useEffect, useState } from 'react';
import { downloadDocument, listDocuments, uploadDocument } from './services/documents.js';
import UploadComponent from './components/UploadComponent.jsx';
import DocumentList from './components/DocumentList.jsx';

const userId = import.meta.env.VITE_DMS_USER_ID?.trim() || 'local-user';

export default function App() {
  const [documents, setDocuments] = useState([]);
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

  async function handleUpload(file) {
    setIsUploading(true);
    setError('');
    setNotice('');
    try {
      await uploadDocument(file, userId);
      setNotice('Documento enviado com sucesso.');
      await refreshDocuments();
      return true;
    } catch (requestError) {
      setError(requestError.message);
      return false;
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

        <UploadComponent userId={userId} isUploading={isUploading} onUpload={handleUpload} />

        {error && <p className="feedback error-feedback" role="alert">{error}</p>}
        {notice && <p className="feedback success-feedback" role="status">{notice}</p>}

        <DocumentList
          documents={documents}
          isLoading={isLoading}
          downloadingId={downloadingId}
          onRefresh={refreshDocuments}
          onDownload={handleDownload}
        />

        <footer className="workspace-footer">
          <span>Armazenamento no dispositivo da aplicação</span>
          <span>Metadados temporários em memória</span>
        </footer>
      </main>
    </div>
  );
}
