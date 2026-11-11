import { useState } from 'react';
import { formatBytes } from './documentFormatters.js';

export default function UploadComponent({ userId, isUploading, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedFile || isUploading) return;

    const form = event.currentTarget;
    const uploaded = await onUpload(selectedFile);
    if (uploaded) {
      setSelectedFile(null);
      form.reset();
    }
  }

  return (
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
        <form className="upload-form" onSubmit={handleSubmit}>
          <label className={`file-picker${selectedFile ? ' has-file' : ''}`}>
            <span className="file-icon" aria-hidden="true">＋</span>
            <span className="file-picker-text">
              <strong>{selectedFile ? selectedFile.name : 'Escolha um arquivo'}</strong>
              <small>{selectedFile ? formatBytes(selectedFile.size) : 'Qualquer formato, conforme limite do servidor'}</small>
            </span>
            <span className="browse-label">Procurar</span>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
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
  );
}