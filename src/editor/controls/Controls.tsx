import { useId } from "react";

// Shell control primitives, styled to the design lock §8.
// Accessible native elements; no third-party runtime UI kit collides here.

export function Slider({
  value, min, max, step = 1, onChange,
}: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-fill">
      <span className="track-bg" />
      <span className="track-active" style={{ width: `${pct}%` }} />
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="seg-sm" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? "is-selected" : ""}
          onClick={() => onChange(o.value)}
          type="button"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({
  value, onChange, type = "text",
}: { value: string; onChange: (v: string) => void; type?: string }) {
  return <input className="field t-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />;
}

export function SelectField<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <select className="field t-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Dial({ deg, onChange }: { deg: number; onChange: (v: number) => void }) {
  const id = useId();
  // 315° = upper-left; hand points toward the light source.
  return (
    <div className="dial" tabIndex={0} aria-label="Light direction" aria-describedby={id}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange((deg + 355) % 360);
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange((deg + 5) % 360);
      }}>
      <span className="hand" style={{ transform: `rotate(${180 - deg}deg)` }} />
    </div>
  );
}
