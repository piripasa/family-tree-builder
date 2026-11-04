"use client";

import { useEffect, useRef, useState } from "react";
import { translateError } from "@/i18n/errors";
import { useI18n } from "@/i18n/I18nProvider";

export function AccountMenu({
  email,
  onSignIn,
  onSignUp,
  onSignOut,
}: {
  email: string | null;
  onSignIn: (email: string, password: string) => Promise<string | null>;
  onSignUp: (email: string, password: string) => Promise<string | null>;
  onSignOut: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { locale, messages } = useI18n();
  const text = messages.account;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector("input")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    setPassword("");
    setError(null);
    setOpen(false);
  }

  if (email) {
    return (
      <div className="account">
        <span className="account-email">{email}</span>
        <button
          type="button"
          onClick={() => {
            setBusy(true);
            void onSignOut().finally(() => setBusy(false));
          }}
          disabled={busy}
        >
          {text.signOut}
        </button>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const nextError = await (mode === "sign-up" ? onSignUp(address, password) : onSignIn(address, password));
    setBusy(false);
    if (nextError) {
      setError(nextError);
      return;
    }
    setPassword("");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode("sign-in");
          setError(null);
          setOpen(true);
        }}
      >
        {text.signIn}
      </button>
      <dialog
        ref={dialogRef}
        className="account-dialog"
        aria-labelledby="account-dialog-title"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current && !busy) dialogRef.current?.close();
        }}
      >
        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <h2 id="account-dialog-title">{mode === "sign-up" ? text.create : text.signIn}</h2>
          <label>
            {text.email}
            <input
              type="email"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {text.password}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>
          {error ? (
            <p className="account-error" role="alert">
              {translateError(locale, error)}
            </p>
          ) : null}
          <div className="account-actions">
            <button type="submit" className="primary" disabled={busy}>
              {mode === "sign-up" ? text.create : text.signIn}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode((value) => (value === "sign-up" ? "sign-in" : "sign-up"));
                setError(null);
              }}
              disabled={busy}
            >
              {mode === "sign-up" ? text.haveAccount : text.create}
            </button>
            <button type="button" onClick={() => dialogRef.current?.close()} disabled={busy}>
              {messages.cancel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
