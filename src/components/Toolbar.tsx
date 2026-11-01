import { AccountMenu } from "@/components/AccountMenu";
import type { SavedTree } from "@/model/types";

export function Toolbar({
  trees,
  activeId,
  title,
  message,
  canExport,
  canDelete,
  sharing,
  onSelectTree,
  onRenameTree,
  onNew,
  onDeleteTree,
  onImport,
  onExport,
  onExportImage,
  onExportPdf,
  onShare,
  onToggleShare,
  onZoomIn,
  onZoomOut,
  onFit,
  accountEmail,
  onSignIn,
  onSignUp,
  onSignOut,
}: {
  trees: SavedTree[];
  activeId: string;
  title: string;
  message: string | null;
  canExport: boolean;
  canDelete: boolean;
  sharing: boolean;
  onSelectTree: (id: string) => void;
  onRenameTree: (title: string) => void;
  onNew: () => void;
  onDeleteTree: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onShare: () => void;
  onToggleShare: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  accountEmail: string | null;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="toolbar">
      <h1>Family tree</h1>
      <AccountMenu email={accountEmail} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} />
      <label className="tree-field">
        Tree
        <select value={activeId} onChange={(event) => onSelectTree(event.target.value)}>
          {trees.map((tree) => (
            <option key={tree.id} value={tree.id}>
              {tree.title.trim() || "Untitled"}
            </option>
          ))}
        </select>
      </label>
      <label className="tree-field">
        Name
        <input
          value={title}
          onChange={(event) => onRenameTree(event.target.value)}
          autoComplete="off"
          maxLength={80}
        />
      </label>
      <div className="toolbar-actions">
        <button type="button" onClick={onNew}>
          New tree
        </button>
        <button type="button" onClick={onDeleteTree} disabled={!canDelete}>
          Delete tree
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
        <button type="button" aria-label="Export as image" onClick={onExportImage} disabled={!canExport}>
          Image
        </button>
        <button type="button" aria-label="Export as printable PDF" onClick={onExportPdf} disabled={!canExport}>
          PDF
        </button>
        <button type="button" onClick={onShare} disabled={!canExport}>
          Share
        </button>
        <button
          type="button"
          aria-pressed={sharing}
          className={sharing ? "primary" : undefined}
          onClick={onToggleShare}
          disabled={!canExport}
        >
          Shared view
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
