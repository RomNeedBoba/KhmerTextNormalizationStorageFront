export default function Sidebar({ active, onSelect }) {
  const Item = ({ id, label }) => (
    <button
      className={`navItem ${active === id ? "navItemActive" : ""}`}
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="nav">
        <Item id="overview" label="Overview" />
        <Item id="textnorm" label="Text Normalization" />
        <Item id="parallelnorm" label="Parallel Norm" /> {/* ✅ NEW */}
      </div>
    </aside>
  );
}