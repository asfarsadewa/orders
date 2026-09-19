// The entry page. Browsers play audio only after a user gesture, so the run
// begins with one click here, and the title music starts on that click.

import { COLONY_NAME } from "../content/scenario";

export function Gate({ onEnter }: { onEnter(sound: boolean): void }) {
  return (
    <div className="gate">
      <div className="gate-inner">
        <div className="gate-mark">
          <span className="wordmark">orders</span>
          <span className="caps dim">{COLONY_NAME}</span>
        </div>
        <img className="gate-art" src="/art/keyart.jpg" alt="Vesper Station on a cold plateau at dusk, with lit windows against snow" width={1536} height={640} />
        <p className="gate-brief">
          Vesper Station is a colony of 184 people on a cold plateau. The main generator is failing. The road out is closed. You take command on day one. Four officers report to you. Each officer applies a different doctrine to the same order.
        </p>
        <div className="row gate-actions">
          <button className="primary" onClick={() => onEnter(true)} autoFocus>
            Enter the station
          </button>
          <button className="ctl ghost" onClick={() => onEnter(false)}>
            Enter without sound
          </button>
        </div>
        <p className="gate-note dim">Music, sound and voice start when you enter. You can switch each off in the header.</p>
      </div>
    </div>
  );
}
