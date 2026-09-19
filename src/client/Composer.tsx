// The command surface. A text box, Send, End day.

import { useEffect, useRef, useState } from "react";
import { ordersLeft } from "../engine/game";
import type { GameState } from "../engine/types";

export function Composer({ state, busy, error, maxChars, onSend, onEnd }: { state: GameState; busy: boolean; error: string | null; maxChars: number; onSend(text: string): void; onEnd(): void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const left = ordersLeft(state);
  const canSend = !busy && left > 0 && text.trim().length > 0 && text.length <= maxChars && !state.ending;
  const open = state.pending.filter((p) => !p.answeredBy);
  useEffect(() => {
    ref.current?.focus();
  }, [state.day]);
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <>
      <div className="composer">
        <textarea
          ref={ref}
          value={text}
          maxLength={maxChars + 50}
          placeholder={left > 0 ? (open.length ? `${open.length === 1 ? "One officer waits for an answer." : `${open.length} officers wait for an answer.`} Write the answer, or end the day.` : "Write an order. Name the officer, the sector and the priority.") : "You have used all three orders. End the day."}
          disabled={busy || left === 0 || !!state.ending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          aria-label="Order"
        />
        <div className="side">
          <button className="primary" disabled={!canSend} onClick={submit}>
            {busy ? "Measuring…" : "Send order"}
          </button>
          <button className="ctl" disabled={busy || !!state.ending} onClick={onEnd}>
            End day {state.day} {left > 0 ? `· ${left} unused` : ""}
          </button>
        </div>
      </div>
      <div className="hint">
        <span>
          <span className="num">{left}</span> of 3 orders left today · Press Enter to send. Press Shift+Enter for a new line.
        </span>
        <span className={error ? "err" : ""}>{error ?? `${text.length}/${maxChars}`}</span>
      </div>
    </>
  );
}
