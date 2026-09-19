// The run in the browser: state, save, resume, and the judge round trip.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyOrder, canOrder, endDay, newGame, replay } from "../engine/game";
import { randomSeed } from "../engine/rng";
import type { GameEvent, GameState, Mode } from "../engine/types";
import { buildJudgeState } from "../judge/state";
import { audio } from "./audio";
import { describeError, judge, startSession } from "./api";

const SAVE_KEY = "orders:run";

interface Save {
  events: GameEvent[];
  session: string;
  expiresAt: number;
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (!Array.isArray(s.events) || typeof s.session !== "string") return null;
    if (s.expiresAt && s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function store(save: Save | null): void {
  try {
    if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // storage unavailable
  }
}

export interface Run {
  state: GameState | null;
  /** Departments currently waiting on the model. */
  busy: boolean;
  error: string | null;
  /** The day report shown in the night overlay, until dismissed. */
  night: number | null;
  start(mode: Mode, turnstileToken: string, seed?: string): Promise<void>;
  resume(): boolean;
  send(text: string): Promise<void>;
  end(): void;
  dismissNight(): void;
  abandon(): void;
}

export function useRun(): Run {
  const [state, setState] = useState<GameState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [night, setNight] = useState<number | null>(null);
  const sessionRef = useRef<Save | null>(null);

  const persist = useCallback((s: GameState | null) => {
    if (!s || !sessionRef.current) return;
    sessionRef.current = { ...sessionRef.current, events: s.events };
    store(sessionRef.current);
  }, []);

  const start = useCallback(async (mode: Mode, token: string, seed?: string) => {
    setError(null);
    setBusy(true);
    try {
      const { session, expiresAt } = await startSession(token);
      const s = newGame(seed ?? randomSeed(), mode);
      sessionRef.current = { events: s.events, session, expiresAt };
      store(sessionRef.current);
      setState(s);
    } catch (e) {
      setError(describeError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  const resume = useCallback((): boolean => {
    const save = loadSave();
    if (!save) return false;
    try {
      const s = replay(save.events);
      sessionRef.current = save;
      setState(s);
      return true;
    } catch {
      store(null);
      return false;
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!state || !sessionRef.current || !canOrder(state) || busy) return;
      setError(null);
      setBusy(true);
      try {
        const js = buildJudgeState(state, text);
        const r = await judge(sessionRef.current.session, js);
        const next = applyOrder(state, text, r.measurements);
        setState(next);
        persist(next);
      } catch (e) {
        setError(describeError(e));
      } finally {
        setBusy(false);
      }
    },
    [state, busy, persist],
  );

  const end = useCallback(() => {
    if (!state || busy || state.ending) return;
    const next = endDay(state);
    setState(next);
    persist(next);
    setNight(next.reports.length - 1);
    audio.sfx("execute");
  }, [state, busy, persist]);

  const dismissNight = useCallback(() => setNight(null), []);

  const abandon = useCallback(() => {
    sessionRef.current = null;
    store(null);
    setState(null);
    setNight(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (state?.ending) store(null);
  }, [state?.ending]);

  return useMemo(() => ({ state, busy, error, night, start, resume, send, end, dismissNight, abandon }), [state, busy, error, night, start, resume, send, end, dismissNight, abandon]);
}

/** Subscribes to the audio manager's settings. */
export function useAudioSettings() {
  const [, force] = useState(0);
  useEffect(() => audio.subscribe(() => force((n) => n + 1)), []);
  return audio.settings;
}
