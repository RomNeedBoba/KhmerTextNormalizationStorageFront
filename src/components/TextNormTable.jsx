export default function TextNormTable({ items, loading, onEdit, onDelete }) {
  const renderTypes = (row) => {
    const arr = row.types || (row.type ? [row.type] : []);
    return arr.join(", ");
  };

  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th>Raw Text</th>
            <th>Types</th>
            <th>Normalized Text</th>
            <th style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className="smallMuted">
                Loading...
              </td>
            </tr>
          )}

          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={4} className="smallMuted">
                No records found.
              </td>
            </tr>
          )}

          {!loading &&
            items.map((row) => (
              <tr key={row._id}>
                <td className="cellPre">{row.rawText}</td>
                <td>{renderTypes(row)}</td>
                <td className="cellPre">{row.normalizedText}</td>
                <td>
                  <div className="actions">
                    <button className="btn" onClick={() => onEdit(row)}>
                      Edit
                    </button>
                    <button className="btn btn-danger" onClick={() => onDelete(row)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}