export function Toolbar({
  message,
  canExport,
  onNew,
  onImport,
  onExport,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  message: string | null;
  canExport: boolean;
  onNew: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <header className="toolbar">
      <h1>Family tree</h1>
      <div className="toolbar-actions">
        <button type="button" onClick={onNew}>
          New
        </button>
        <label className="file-button">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }}
          />
        </label>
        <button type="button" onClick={onExport} disabled={!canExport}>
          Export
        </button>
        <span className="toolbar-gap" />
        <button type="button" aria-label="Zoom in" onClick={onZoomIn}>
          +
        </button>
        <button type="button" aria-label="Zoom out" onClick={onZoomOut}>
          −
        </button>
        <button type="button" onClick={onFit}>
          Fit
        </button>
      </div>
      {message ? (
        <p className="toolbar-message" role="alert">
          {message}
        </p>
      ) : null}
    </header>
  );
}
