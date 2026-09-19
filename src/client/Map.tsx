// The colony as a schematic, drawn from state. Every mark on it is a number in
// the world: heat, fire, damage, people, the fence, what is outside.

import { SECTOR_LETTER, SECTOR_NAME } from "../content/scenario";
import type { SectorId, World } from "../engine/types";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const LAYOUT: Record<Exclude<SectorId, "perimeter">, Box> = {
  core: { x: 60, y: 96, w: 170, h: 110 },
  habitat: { x: 260, y: 76, w: 260, h: 130 },
  works: { x: 60, y: 226, w: 200, h: 96 },
  infirmary: { x: 300, y: 226, w: 190, h: 96 },
};

function Flames({ box, fire }: { box: Box; fire: number }) {
  if (fire <= 0) return null;
  const n = Math.max(1, Math.round(fire * 6));
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = box.x + 14 + ((i * 37) % (box.w - 28));
    const y = box.y + 12 + ((i * 23) % 18);
    out.push(<path key={i} className="flame" d={`M${x} ${y + 12} q-5 -6 0 -12 q1 5 4 6 q2 -3 1 -6 q6 6 -1 12 z`} style={{ animationDelay: `${(i * 0.17) % 0.9}s` }} />);
  }
  return <>{out}</>;
}

function Sector({ id, w, selected, onSelect }: { id: Exclude<SectorId, "perimeter">; w: World; selected: SectorId | null; onSelect(s: SectorId): void }) {
  const box = LAYOUT[id];
  const s = w.sectors[id];
  const cls = ["sector", s.fire > 0 ? "fire" : s.heated ? "heated" : w.weather.tempC < 0 ? "cold" : "", selected === id ? "selected" : ""].filter(Boolean).join(" ");
  const flags: string[] = [];
  if (!s.heated && w.weather.tempC < 0) flags.push("unheated");
  if (s.fire > 0) flags.push(`fire ${Math.round(s.fire * 100)}%`);
  if (s.damage > 0.4) flags.push(`damage ${Math.round(s.damage * 100)}%`);
  if (id === "habitat" && w.people.trapped > 0) flags.push(`${w.people.trapped} trapped`);
  if (id === "works" && w.water.pipesFrozen) flags.push("pipes frozen");
  if (id === "works" && w.water.contaminated) flags.push("water fouled");
  if (id === "core" && w.power.isolated > 0) flags.push("generator isolated");
  if (id === "infirmary" && w.medicine.ward === "core") flags.push("wards moved to core");
  if (id === "core" && w.medicine.ward === "core") flags.push("wards here");
  return (
    <g onClick={() => onSelect(id)} style={{ cursor: "pointer" }} role="button" aria-label={`${SECTOR_NAME[id]}: ${s.people} people${flags.length ? ", " + flags.join(", ") : ""}`}>
      <rect className={cls} x={box.x} y={box.y} width={box.w} height={box.h} />
      <text className="letter" x={box.x + 12} y={box.y + 30}>
        {SECTOR_LETTER[id]}
      </text>
      <text className="label" x={box.x + 40} y={box.y + 28}>
        {SECTOR_NAME[id].toUpperCase()}
      </text>
      <text className="count" x={box.x + 12} y={box.y + 50}>
        {s.people} people
      </text>
      {flags.map((f, i) => (
        <text key={f} className={`flag ${f.startsWith("fire") || f.includes("trapped") ? "red" : "amber"}`} x={box.x + 12} y={box.y + 68 + i * 15} fill={f.startsWith("fire") || f.includes("trapped") ? "var(--red)" : "var(--amber)"}>
          {f}
        </text>
      ))}
      <Flames box={box} fire={s.fire} />
    </g>
  );
}

export function ColonyMap({ world, selected, onSelect }: { world: World; selected: SectorId | null; onSelect(s: SectorId): void }) {
  const w = world;
  const contact = w.security.contact;
  const contactText = contact === "unknown" ? (w.security.threat > 0.25 ? "movement outside" : "") : contact === "none" ? "" : contact === "refugees" ? (w.security.admitted ? "" : "refugees at the gate") : contact === "raiders" ? "armed band" : w.roadOpen ? "relief column at the pass" : "relief scouts";
  return (
    <svg className="map" viewBox="0 0 600 360" role="img" aria-label="Map of Vesper Station">
      {/* fence and gate */}
      <rect className={`fence ${selected === "perimeter" ? "selected" : ""}`} x={30} y={48} width={540} height={296} strokeOpacity={0.4 + 0.6 * w.security.perimeter} onClick={() => onSelect("perimeter")} style={{ cursor: "pointer" }} />
      <path className="road" d="M300 344 L300 360" />
      <rect x={288} y={339} width={24} height={10} fill={w.security.perimeter < 0.5 ? "var(--red)" : "var(--dim)"} />
      <text className="label" x={318} y={354}>
        GATE {Math.round(w.security.perimeter * 100)}%{w.security.guarded ? " · GUARDED" : ""}
      </text>
      <text className="label" x={40} y={38}>
        PERIMETER · THREAT {Math.round(w.security.threat * 100)}%
      </text>
      <text className="weather" x={560} y={38} textAnchor="end">
        {w.weather.kind.toUpperCase()} · {w.weather.tempC} C
      </text>
      {contactText && (
        <g>
          <circle className="contact" cx={556} cy={62} r={4} />
          <text className="flag" x={546} y={66} textAnchor="end" fill="var(--amber)">
            {contactText.toUpperCase()}
          </text>
        </g>
      )}
      {w.roadOpen && (
        <text className="flag" x={300} y={18} textAnchor="middle" fill="var(--green)">
          ROAD TO THE PASS OPEN
        </text>
      )}
      {(Object.keys(LAYOUT) as (keyof typeof LAYOUT)[]).map((id) => (
        <Sector key={id} id={id} w={w} selected={selected} onSelect={onSelect} />
      ))}
    </svg>
  );
}
