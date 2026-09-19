// The start screen. One Turnstile check, a mode, a seed if you want one.

import { useRef, useState } from "react";
import { OFFICER_LIST } from "../content/officers";
import type { Mode } from "../engine/types";
import { useTurnstile } from "./turnstile";

const MODES: { id: Mode; name: string; blurb: string }[] = [
  { id: "analyst", name: "Analyst", blurb: "The full measurement shows under each order when you send it." },
  { id: "commander", name: "Commander", blurb: "The officers answer when you send an order. The measurement and the trace open after you end the day." },
  { id: "iron", name: "Iron Command", blurb: "You see only the officers' words and the results. The trace opens when the run ends." },
];

export function Title({ siteKey, busy, error, canResume, onStart, onResume, onHelp }: { siteKey: string | null; busy: boolean; error: string | null; canResume: boolean; onStart(mode: Mode, token: string, seed?: string): void; onResume(): void; onHelp(): void }) {
  const [mode, setMode] = useState<Mode>("commander");
  const [seed, setSeed] = useState("");
  const slot = useRef<HTMLDivElement>(null);
  const turnstile = useTurnstile(siteKey, slot);
  const [waiting, setWaiting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const start = async () => {
    setLocalError(null);
    setWaiting(true);
    try {
      const token = await turnstile.getToken();
      onStart(mode, token, seed.trim() || undefined);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : "verification failed");
      turnstile.reset();
    } finally {
      setWaiting(false);
    }
  };
  return (
    <div className="title">
      <div>
        <h2>
          A command game where the enemy is <em>what people think you meant.</em>
        </h2>
      </div>
      <p className="lead">
        You command Vesper Station, a colony of 184 people, for 14 days after a systems failure. You write orders in plain text to four officers, up to three orders each day. A calibrated model measures each order. Each officer applies a different doctrine to the same measurement and selects one action. After each day, the trace shows the numbers behind each action.
      </p>
      <div className="keyart">
        <img src="/art/keyart.jpg" alt="Vesper Station on a cold plateau at dusk, lit windows against snow" width={1536} height={640} onError={(e) => ((e.currentTarget.parentElement as HTMLElement).style.display = "none")} />
      </div>
      <div className="roster">
        {OFFICER_LIST.map((o) => (
          <div className="card" key={o.id}>
            <img src={`/art/${o.short}-128.webp`} alt="" width={96} height={96} onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
            <b>{o.name}</b>
            <span>{o.traits}</span>
          </div>
        ))}
      </div>
      <div className="start">
        <div className="modes">
          {MODES.map((m) => (
            <button key={m.id} className="mode" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              <b>{m.name}</b>
              <span>{m.blurb}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <label className="ctl" style={{ gap: 8 }}>
            <span className="dim">seed</span>
            <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="random" maxLength={24} style={{ border: 0, background: "transparent", width: "12ch", outline: "none" }} aria-label="Seed" />
          </label>
          <button className="primary" disabled={busy || waiting || turnstile.state === "error" || !siteKey} onClick={start}>
            {waiting || busy ? "Starting…" : "Take command"}
          </button>
          {canResume && (
            <button className="ctl" onClick={onResume}>
              Resume the saved run
            </button>
          )}
          <button className="ctl ghost" onClick={onHelp}>
            how it works
          </button>
        </div>
        <div ref={slot} className="turnstile-slot" />
        {(error || localError || turnstile.state === "error") && <div className="red">{error ?? localError ?? "Verification did not load. Reload the page."}</div>}
        <div className="dim" style={{ fontSize: 12, lineHeight: "18px" }}>
          You complete one verification for each run. The server holds the model key and measures your orders. The server logs the request size and time, not the order text. The game runs in this tab and saves to this tab. There is no account.
        </div>
      </div>
    </div>
  );
}
