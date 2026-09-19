import { useEffect, useState } from "react";
import { COLONY_NAME } from "../content/scenario";
import type { Department, SectorId } from "../engine/types";
import { fetchConfig, type Config } from "./api";
import { audio } from "./audio";
import { Composer } from "./Composer";
import { EndingScreen } from "./Ending";
import { Gate } from "./Gate";
import { Help } from "./Help";
import { useAudioSettings, useRun, loadSave } from "./hooks";
import { Inspector, type InspectorTarget } from "./Inspector";
import { Log } from "./Log";
import { ColonyMap } from "./Map";
import { NightSheet } from "./Night";
import { OfficerStrip } from "./Officers";
import { Replay } from "./Replay";
import { StatusBoard } from "./Status";
import { Title } from "./Title";

type View = "gate" | "title" | "run" | "help" | "replay";

function XMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function App() {
  const run = useRun();
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [view, setView] = useState<View>("gate");
  const [inspect, setInspect] = useState<InspectorTarget | null>(null);
  const [sector, setSector] = useState<SectorId | null>(null);
  const [canResume, setCanResume] = useState(false);
  const settings = useAudioSettings();

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((e) => setConfigError(e instanceof Error ? e.message : "could not load"));
    setCanResume(loadSave() !== null);
  }, []);

  const state = run.state;
  useEffect(() => {
    if (view === "run" && state && !run.night && !state.ending) audio.music("day");
    if (view === "title") audio.music("title");
    if (state?.ending && view === "run") audio.music("title");
  }, [view, state, run.night]);

  // Voice the acknowledgements as they arrive.
  useEffect(() => {
    if (!state || !state.todayUtterances.length) return;
    const latestOrder = state.today[state.today.length - 1];
    if (!latestOrder) return;
    const mine = state.todayUtterances.filter((u) => u.orderId === latestOrder.id);
    let i = 0;
    let cancelled = false;
    const next = async () => {
      if (cancelled || i >= mine.length) return;
      const u = mine[i++];
      audio.sfx(u.act === "clarify" ? "clarify" : u.act === "warn" || u.act === "object" || u.act === "challenge_precedent" ? "warn" : "ack");
      await audio.speak(u.lineId);
      void next();
    };
    void next();
    return () => {
      cancelled = true;
    };
  }, [state?.today.length, state?.todayUtterances.length]);

  const startRun = async (mode: Parameters<typeof run.start>[0], token: string, seed?: string) => {
    audio.unlock();
    try {
      await run.start(mode, token, seed);
      setView("run");
      setInspect(null);
    } catch {
      // error shown on the title
    }
  };

  const resume = () => {
    audio.unlock();
    if (run.resume()) setView("run");
  };

  const onWhy = (day: number, department: Department) => setInspect({ day, department });
  const onOfficer = (d: Department) => {
    if (!state) return;
    audio.sfx("click");
    setInspect(inspect?.department === d && inspect.day === state.day ? null : { day: state.day, department: d });
  };

  const toggle = (k: "music" | "sfx" | "voice") => {
    audio.unlock();
    audio.setSettings({ [k]: !settings[k] });
  };

  const enter = (sound: boolean) => {
    audio.unlock();
    if (!sound) audio.setSettings({ music: false, sfx: false, voice: false });
    else audio.music("title");
    setView("title");
  };

  if (view === "gate") return <Gate onEnter={enter} />;

  const showRun = view === "run" && state;
  return (
    <div className={`app ${showRun ? "playing" : ""}`}>
      <header className="top">
        <h1 className="wordmark">
          orders
          <small>{COLONY_NAME}</small>
        </h1>
        {showRun && (
          <div className="clock" aria-live="polite">
            <span className="day">Day {Math.min(state.day, 14)}</span>
            <span className="dim">of 14</span>
            <span className="dim">·</span>
            <span className="dim">{state.mode === "iron" ? "iron command" : state.mode}</span>
            <span className="dim">·</span>
            <span className="dim num">{state.seed}</span>
          </div>
        )}
        <div className="row">
          <button className="ctl" aria-pressed={settings.music} onClick={() => toggle("music")} title="Music">
            music
          </button>
          <button className="ctl" aria-pressed={settings.sfx} onClick={() => toggle("sfx")} title="Sound">
            sound
          </button>
          <button className="ctl" aria-pressed={settings.voice} onClick={() => toggle("voice")} title="Voice">
            voice
          </button>
          {showRun && !state.ending && (
            <button
              className="ctl ghost"
              onClick={() => {
                if (window.confirm("Abandon this run? This deletes the save.")) {
                  run.abandon();
                  setView("title");
                }
              }}
            >
              abandon
            </button>
          )}
          <button className="ctl ghost" onClick={() => setView(view === "help" ? (state ? "run" : "title") : "help")}>
            help
          </button>
        </div>
      </header>

      <main>
        {view === "help" && <Help onClose={() => setView(state ? "run" : "title")} />}
        {view === "title" && (
          <Title siteKey={config?.siteKey ?? null} busy={run.busy} error={run.error ?? configError} canResume={canResume} onStart={startRun} onResume={resume} onHelp={() => setView("help")} />
        )}
        {view === "replay" && state && <Replay state={state} onBack={() => setView("run")} />}
        {showRun && state.ending && (
          <EndingScreen
            state={state}
            onReplay={() => setView("replay")}
            onNew={() => {
              run.abandon();
              setCanResume(false);
              setView("title");
            }}
          />
        )}
        {showRun && !state.ending && (
          <div className="run">
            <section className="panel map-panel" aria-label="Map">
              <header>
                <span>
                  {COLONY_NAME} · {state.world.people.total} inside
                </span>
                <span>
                  {state.world.weather.kind} · {state.world.weather.tempC} C tonight
                </span>
              </header>
              <ColonyMap world={state.world} selected={sector} onSelect={(s) => setSector(sector === s ? null : s)} />
              <div className="map-legend">
                <span>
                  <b>A</b> core · generator, battery, command
                </span>
                <span>
                  <b>B</b> habitat
                </span>
                <span>
                  <b>C</b> works · pumps, fuel, trucks
                </span>
                <span>
                  <b>D</b> infirmary
                </span>
              </div>
            </section>
            <section className="panel status-panel" aria-label="Colony status">
              <header>
                <span>Colony status</span>
                <span>{state.world.crises.length} active</span>
              </header>
              <StatusBoard world={state.world} />
            </section>
            <section className="panel officers-panel" aria-label="Officers">
              <header>
                <span>Officers</span>
                <span>select an officer to open the trace</span>
              </header>
              <OfficerStrip state={state} busy={run.busy} selected={inspect?.department ?? null} onSelect={onOfficer} />
            </section>
            <section className="panel log-panel" aria-label="Command history and reports">
              <header>
                <span>Command history</span>
                <span>
                  {state.ledger.length + state.today.length} orders · {state.standing.filter((s) => !s.supersededBy).length} standing
                </span>
              </header>
              <Log state={state} onWhy={onWhy} />
            </section>
            <section className="panel composer-panel" aria-label="Command">
              <Composer
                state={state}
                busy={run.busy}
                error={run.error}
                maxChars={config?.maxChars ?? 600}
                onSend={(t) => {
                  audio.unlock();
                  audio.sfx("send");
                  void run.send(t);
                }}
                onEnd={() => {
                  audio.unlock();
                  run.end();
                }}
              />
            </section>
          </div>
        )}
      </main>

      {inspect && state && <Inspector state={state} target={inspect} onClose={() => setInspect(null)} />}
      {run.night !== null && state && state.reports[run.night] && <NightSheet report={state.reports[run.night]} onDone={run.dismissNight} />}

      <footer>
        <span>
          <a href="https://github.com/asfarsadewa/orders">source</a> · MIT · measured by{" "}
          <a href="https://typesafe.ai" rel="noopener">
            TypeSafe Jev
          </a>
          {config ? ` · ${config.model}` : ""}
        </span>
        <a className="x" href="https://x.com/ashthepeasant" rel="noopener">
          <XMark />
          ashthepeasant
        </a>
      </footer>
    </div>
  );
}
