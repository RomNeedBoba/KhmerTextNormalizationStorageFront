import { TEXTNORM_TYPES } from "../constants/textnorm";

export default function TypeChecklist({ value, onChange }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (t) => {
    if (selected.includes(t)) onChange(selected.filter((x) => x !== t));
    else onChange([...selected, t]);
  };

  return (
    <div className="typeChecklist">
      {TEXTNORM_TYPES.map((t) => (
        <label key={t} className="typeItem">
          <input
            type="checkbox"
            checked={selected.includes(t)}
            onChange={() => toggle(t)}
          />
          <span>{t}</span>
        </label>
      ))}
    </div>
  );
}