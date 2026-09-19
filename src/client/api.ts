// The Worker's endpoints. The browser never holds a model key; it holds a run
// session token issued after one Turnstile check.

import type { Measurements } from "../engine/types";
import type { JudgeState } from "../judge/questions";

export interface Config {
  siteKey: string;
  maxChars: number;
  version: string;
  model: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function parse<T>(r: Response): Promise<T> {
  const data: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(r.status, err?.code ?? "http", err?.message ?? `request failed (${r.status})`);
  }
  return data as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  return parse<T>(
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

export async function fetchConfig(): Promise<Config> {
  return parse<Config>(await fetch("/api/config", { headers: { Accept: "application/json" } }));
}

export async function startSession(token: string): Promise<{ session: string; expiresAt: number }> {
  return post("/api/session", { token });
}

export interface JudgeResponse {
  measurements: Measurements;
  model: string;
  ms: number;
  usage: { input_tokens: number; output_tokens: number };
}

export async function judge(session: string, state: JudgeState): Promise<JudgeResponse> {
  return post("/api/judge", { session, state });
}

/** A human-readable reason for a failed call. */
export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return "Too many orders. Wait a moment.";
    if (e.status === 401) return "The run session expired. Start a new run.";
    if (e.status === 503 || e.status === 504) return "The model is busy. Try again.";
    return e.message;
  }
  return e instanceof Error ? e.message : "The request failed.";
}
