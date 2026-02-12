export default function ParallelNormTable({ items, loading }) {
  return (
    <div className="tableWrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: "20%" }}>Span Raw</th>
            <th style={{ width: "16%" }}>Span Types</th>
            <th style={{ width: "24%" }}>Span Normalized</th>
            <th style={{ width: "40%" }}>Sentence (Context)</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="smallMuted">
                Loading...
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={4} className="smallMuted">
                No parallel records
              </td>
            </tr>
          ) : (
            items.map((row) => (
              <tr key={row._id}>
                <td style={{ whiteSpace: "pre-wrap" }}>{row.spanRawText}</td>
                <td>{(row.spanTypes || row.types || []).join(", ")}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{row.spanNormalizedText}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{row.rawText}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}