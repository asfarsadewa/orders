// Music, sound effects and pre-rendered voice. Everything is a static file;
// nothing is synthesised here. Audio only starts after a user gesture.

export interface AudioSettings {
  music: boolean;
  sfx: boolean;
  voice: boolean;
}

export type SfxName = "send" | "ack" | "clarify" | "warn" | "execute" | "alarm" | "loss" | "relief" | "dawn" | "click" | "ending-good" | "ending-bad";

export type MusicName = "title" | "day" | "night";

interface AudioManifest {
  sfx: Record<string, { file: string; seconds: number; loop: boolean; gainDb: number }>;
  music: Record<string, { file: string; seconds: number }>;
}

interface VoiceManifest {
  clips: Record<string, { seconds: number; bytes: number }>;
}

const SETTINGS_KEY = "orders:audio";
const MUSIC_VOLUME = 0.3;
const SFX_VOLUME = 0.7;
const VOICE_VOLUME = 0.95;
const FADE_MS = 1400;

function loadSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioSettings>;
      return { music: p.music ?? true, sfx: p.sfx ?? true, voice: p.voice ?? true };
    }
  } catch {
    // storage unavailable
  }
  return { music: true, sfx: true, voice: true };
}

class Manager {
  settings: AudioSettings = loadSettings();
  private unlocked = false;
  private manifest: AudioManifest | null = null;
  private voice: VoiceManifest | null = null;
  private current: { name: MusicName; el: HTMLAudioElement } | null = null;
  private speaking: HTMLAudioElement | null = null;
  private speakToken = 0;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window === "undefined") return;
    void fetch("/audio/manifest.json")
      .then((r) => (r.ok ? (r.json() as Promise<AudioManifest>) : null))
      .then((m) => {
        this.manifest = m;
      })
      .catch(() => undefined);
    void fetch("/voice/manifest.json")
      .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
      .then((m) => {
        this.voice = m;
      })
      .catch(() => undefined);
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setSettings(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // storage unavailable
    }
    if (!this.settings.music && this.current) this.music(null);
    if (!this.settings.voice) this.stopSpeaking();
    for (const fn of this.listeners) fn();
  }

  /** Call from a click handler once; browsers refuse audio before a gesture. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    const el = new Audio();
    el.muted = true;
    void el.play().catch(() => undefined);
  }

  hasVoice(key: string): boolean {
    return this.voice?.clips[key] !== undefined;
  }

  /** Plays one clip. Resolves when finished, or at once if voice is off or the clip is missing. */
  async speak(key: string): Promise<void> {
    this.stopSpeaking();
    if (!this.settings.voice || !this.unlocked || !this.hasVoice(key)) return;
    const token = ++this.speakToken;
    const el = new Audio(`/voice/${key}.mp3`);
    el.volume = VOICE_VOLUME;
    this.speaking = el;
    this.duck(true);
    await new Promise<void>((resolve) => {
      const done = () => {
        el.removeEventListener("ended", done);
        el.removeEventListener("error", done);
        resolve();
      };
      el.addEventListener("ended", done);
      el.addEventListener("error", done);
      el.play().catch(done);
    });
    if (token === this.speakToken) {
      this.speaking = null;
      this.duck(false);
    }
  }

  stopSpeaking(): void {
    this.speakToken++;
    if (this.speaking) {
      try {
        this.speaking.pause();
      } catch {
        // already stopped
      }
      this.speaking = null;
      this.duck(false);
    }
  }

  sfx(name: SfxName): void {
    if (!this.settings.sfx || !this.unlocked) return;
    const meta = this.manifest?.sfx[name];
    if (!meta) return;
    const el = new Audio(meta.file);
    const gain = 10 ** (meta.gainDb / 20);
    el.volume = Math.min(1, SFX_VOLUME * gain);
    void el.play().catch(() => undefined);
  }

  /** Crossfades to a track, or fades out with null. */
  music(name: MusicName | null): void {
    if (this.current?.name === name) return;
    const old = this.current;
    this.current = null;
    if (old) this.fade(old.el, 0, () => old.el.pause());
    if (!name || !this.settings.music || !this.unlocked) return;
    const meta = this.manifest?.music[name];
    if (!meta) return;
    const el = new Audio(meta.file);
    el.loop = true;
    el.volume = 0;
    this.current = { name, el };
    el.play()
      .then(() => this.fade(el, MUSIC_VOLUME))
      .catch(() => {
        if (this.current?.el === el) this.current = null;
      });
  }

  /** Ducks the music while an officer speaks. */
  private duck(on: boolean): void {
    if (!this.current) return;
    this.fade(this.current.el, on ? MUSIC_VOLUME * 0.4 : MUSIC_VOLUME, undefined, 350);
  }

  private fade(el: HTMLAudioElement, to: number, done?: () => void, ms = FADE_MS): void {
    const from = el.volume;
    const start = performance.now();
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / ms);
      el.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else done?.();
    };
    step();
  }
}

export const audio = new Manager();
