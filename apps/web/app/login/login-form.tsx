"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(login, undefined);
  const message = state?.error ?? notice;

  return (
    <form action={formAction} className="mt-8 space-y-5">
      {message && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {message}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          className="input"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
