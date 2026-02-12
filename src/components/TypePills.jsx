import { TEXTNORM_TYPES } from "../constants/textnorm";

/**
 * Multi-select pills.
 * value: string[] (selected)
 * onChange: (nextSelected: string[]) => void
 */
export default function TypePills({ value, onChange, ariaLabel = "Types" }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (t) => {
    if (selected.includes(t)) onChange(selected.filter((x) => x !== t));
    else onChange([...selected, t]);
  };

  return (
    <div className="pillGrid" role="group" aria-label={ariaLabel}>
      {TEXTNORM_TYPES.map((t) => {
        const active = selected.includes(t);
        return (
          <button
            type="button"
            key={t}
            className={`pill ${active ? "pillActive" : ""}`}
            onClick={() => toggle(t)}
            aria-pressed={active}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}