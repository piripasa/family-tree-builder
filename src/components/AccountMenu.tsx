"use client";

import { useState } from "react";

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
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

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
          Sign out
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Sign in
      </button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const error = await (mode === "sign-up" ? onSignUp(address, password) : onSignIn(address, password));
    setBusy(false);
    if (error) return;
    setPassword("");
    setOpen(false);
  }

  return (
    <form className="account" onSubmit={(event) => void submit(event)}>
      <input
        type="email"
        aria-label="Email"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        autoComplete="username"
        required
      />
      <input
        type="password"
        aria-label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        minLength={8}
        required
      />
      <button type="submit" className="primary" disabled={busy}>
        {mode === "sign-up" ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        onClick={() => setMode((value) => (value === "sign-up" ? "sign-in" : "sign-up"))}
        disabled={busy}
      >
        {mode === "sign-up" ? "Have an account?" : "Create account"}
      </button>
    </form>
  );
}
