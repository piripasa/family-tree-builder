"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onImport,
  onExport,
  onExportGedcom,
  onExportImage,
  onExportPdf,
  onExportReport,
  onShare,
  shareNotice,
  onReplaceShare,
  onRevokeShare,
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
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onExportGedcom: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onExportReport: () => void;
  onShare: () => void;
  shareNotice: { url: string; copied: boolean } | null;
  onReplaceShare: () => void;
  onRevokeShare: () => void;
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
      <h1>
        <Link href="/">Family tree</Link>
      </h1>
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
        <button type="button" onClick={onUndo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" onClick={onRedo} disabled={!canRedo}>
          Redo
        </button>
        <label className="file-button">
          Import
          <input
            type="file"
            accept="application/json,.json,.ged,.gedcom,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImport(file);
            }}
          />
        </label>
        <ExportMenu
          disabled={!canExport}
          onExport={onExport}
          onExportGedcom={onExportGedcom}
          onExportImage={onExportImage}
          onExportPdf={onExportPdf}
          onExportReport={onExportReport}
          onShare={onShare}
        />
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
      {shareNotice ? (
        <p className="toolbar-notice">
          <span>{shareNotice.copied ? "Share link copied." : "Share link"}</span>
          <a href={shareNotice.url}>{shareNotice.url}</a>
          <button type="button" onClick={onReplaceShare}>
            Replace link
          </button>
          <button type="button" onClick={onRevokeShare}>
            Turn off
          </button>
        </p>
      ) : null}
    </header>
  );
}

function ExportMenu({
  disabled,
  onExport,
  onExportGedcom,
  onExportImage,
  onExportPdf,
  onExportReport,
  onShare,
}: {
  disabled: boolean;
  onExport: () => void;
  onExportGedcom: () => void;
  onExportImage: () => void;
  onExportPdf: () => void;
  onExportReport: () => void;
  onShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const items = [
    { label: "JSON", action: onExport },
    { label: "GEDCOM", action: onExportGedcom },
    { label: "Image", action: onExportImage },
    { label: "PDF", action: onExportPdf },
    { label: "Report", action: onExportReport },
    { label: "Share", action: onShare },
  ];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </button>
      {open ? (
        <div className="menu-panel" id={menuId} role="menu">
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" onClick={() => choose(item.action)}>
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
