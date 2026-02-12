import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import TextNormTable from "../components/TextNormTable";
import TextNormFormModal from "../components/TextNormFormModal";
import BulkUploadModal from "../components/BulkUploadModal";
import { TEXTNORM_TYPES } from "../constants/textnorm";

export default function TextNormPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [typeQuick, setTypeQuick] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/textnorm", {
        params: {
          page,
          limit,
          q: q || undefined,
          types: typeQuick || undefined,
        },
      });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, typeQuick]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchData();
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onEdit = (row) => {
    setEditing(row);
    setFormOpen(true);
  };

  const onDelete = async (row) => {
    // if (!confirm("Delete this record?")) return;
    await api.delete(`/api/textnorm/${row._id}`);
    fetchData();
  };

  const downloadCsv = async () => {
    // ✅ Ask user once, same button
    const includeSpan = window.confirm("Include Parallel/Span-Level data in CSV export?");

    try {
      const res = await api.get("/api/textnorm/export.csv", {
        params: {
          q: q.trim() || undefined,
          types: typeQuick ? [typeQuick] : undefined,
          includeSpan: includeSpan ? "1" : undefined, // ✅ NEW
        },
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = includeSpan
        ? "khmer_text_normalization_with_span.csv"
        : "khmer_text_normalization_tts.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || e.message || "Export failed (unauthorized?)");
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="pageHeader">
        <h2>Text Normalization</h2>

        <div className="toolbar">
          <button className="btn" onClick={downloadCsv}>
            Download CSV
          </button>
          <button className="btn" onClick={() => setBulkOpen(true)}>
            Bulk Add (CSV)
          </button>
          <button className="btn btn-primary" onClick={onAdd}>
            Add
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card controlBarMinimal">
        <div className="totalInline">
          <span className="totalLabel">Total :</span>
          <span className="totalValue">{total}</span>
        </div>

        <div className="miniControl">
          <label className="miniLabel">Type</label>
          <select
            className="miniSelect"
            value={typeQuick}
            onChange={(e) => {
              setPage(1);
              setTypeQuick(e.target.value);
            }}
          >
            <option value="">All</option>
            {TEXTNORM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="miniControl miniSearch">
          <label className="miniLabel">Search</label>
          <input className="miniInput" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        <TextNormTable items={items} loading={loading} onEdit={onEdit} onDelete={onDelete} />

        <div className="pager">
          <div className="pagerRight">
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>

            <div className="smallMuted">
              Page {page} / {totalPages}
            </div>

            <button className="btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </button>
          </div>
        </div>
      </div>

      <TextNormFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        initial={editing}
        onSaved={() => {
          setFormOpen(false);
          fetchData();
        }}
      />

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onUploaded={() => {
          setBulkOpen(false);
          fetchData();
        }}
      />
    </div>
  );
}