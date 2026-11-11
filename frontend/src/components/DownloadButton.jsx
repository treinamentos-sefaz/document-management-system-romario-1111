export default function DownloadButton({ document, isDownloading, onDownload }) {
  return (
    <button
      className="download-button"
      type="button"
      onClick={() => onDownload(document)}
      disabled={isDownloading}
      aria-label={`Baixar ${document.originalName}`}
      title="Baixar documento"
    >
      {isDownloading ? '...' : '↓'}
    </button>
  );
}