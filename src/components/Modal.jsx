export default function Modal({ open, title, children, width }) {
  if (!open) return null;

  return (
    <div className="modalOverlay">
      <div className="modal" style={width ? { width } : undefined}>
        <div className="modalHeader">
          <h3>{title}</h3>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}