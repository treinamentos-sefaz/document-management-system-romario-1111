import DownloadButton from './DownloadButton.jsx';
import { formatBytes, formatDate } from './documentFormatters.js';

export default function DocumentList({
  documents,
  isLoading,
  downloadingId,
  onRefresh,
  onDownload,
}) {
  return (
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
        <button
          className="refresh-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Atualizar lista de documentos"
          title="Atualizar lista"
        >
          <span aria-hidden="true">↻</span>
        </button>
      </div>

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
              <DownloadButton
                document={document}
                isDownloading={downloadingId === document.id}
                onDownload={onDownload}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}