"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useI18n } from "@/i18n/I18nProvider";
import { translateError } from "@/i18n/errors";
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
  const { locale, messages } = useI18n();
  const text = messages.toolbar;
  return (
    <header className="toolbar">
      <div className="toolbar-bar">
        <Link className="brand" href="/" aria-label={messages.appName}>
          <img src="/family-tree-logo.png" alt="" />
        </Link>
        <div className="toolbar-identity">
          {accountEmail ? (
            <label className="tree-field">
              {text.tree}
              <select value={activeId} onChange={(event) => onSelectTree(event.target.value)}>
                {trees.map((tree) => (
                  <option key={tree.id} value={tree.id}>
                    {tree.title.trim() || messages.untitled}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="tree-field">
            {text.name}
            <input
              value={title}
              onChange={(event) => onRenameTree(event.target.value)}
              autoComplete="off"
              maxLength={80}
            />
          </label>
        </div>
        <div className="toolbar-account">
          <LanguageSwitch bare />
          <AccountMenu email={accountEmail} onSignIn={onSignIn} onSignUp={onSignUp} onSignOut={onSignOut} />
        </div>
      </div>
      <div className="toolbar-tools">
        <div className="tool-group">
          <button type="button" onClick={onNew}>
            {text.newTree}
          </button>
          <button type="button" onClick={onDeleteTree} disabled={!canDelete}>
            {text.deleteTree}
          </button>
        </div>
        <div className="tool-group">
          <button type="button" onClick={onUndo} disabled={!canUndo}>
            {text.undo}
          </button>
          <button type="button" onClick={onRedo} disabled={!canRedo}>
            {text.redo}
          </button>
        </div>
        <div className="tool-group">
          <label className="file-button">
            {text.import}
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
            {text.sharedView}
          </button>
        </div>
        <div className="tool-group toolbar-zoom">
          <button type="button" aria-label={text.zoomIn} onClick={onZoomIn}>
            +
          </button>
          <button type="button" aria-label={text.zoomOut} onClick={onZoomOut}>
            −
          </button>
          <button type="button" onClick={onFit}>
            {text.fit}
          </button>
        </div>
      </div>
      {message ? (
        <p className="toolbar-message" role="alert">
          {translateError(locale, message)}
        </p>
      ) : null}
      {shareNotice ? (
        <p className="toolbar-notice">
          <span>{shareNotice.copied ? text.shareCopied : text.shareLink}</span>
          <a href={shareNotice.url}>{shareNotice.url}</a>
          <button type="button" onClick={onReplaceShare}>
            {text.replaceLink}
          </button>
          <button type="button" onClick={onRevokeShare}>
            {text.turnOff}
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
  const { messages } = useI18n();
  const text = messages.exportMenu;
  const items = [
    { label: text.json, action: onExport },
    { label: text.gedcom, action: onExportGedcom },
    { label: text.image, action: onExportImage },
    { label: text.pdf, action: onExportPdf },
    { label: text.report, action: onExportReport },
    { label: text.share, action: onShare },
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
        {messages.toolbar.export}
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
