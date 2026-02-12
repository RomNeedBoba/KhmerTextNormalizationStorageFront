import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { TEXTNORM_TYPES } from "../constants/textnorm";
import ParallelNormTable from "../components/ParallelNormTable";

export default function ParallelNormPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [typeQuick, setTypeQuick] = useState("");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/textnorm", {
        params: {
          page,
          limit,
          q: q || undefined,
          types: typeQuick ? [typeQuick] : undefined,
        },
      });

      // show only docs with span
      const onlySpan = (res.data.items || []).filter((x) => {
        const sr = String(x.spanRawText || "").trim();
        const sn = String(x.spanNormalizedText || "").trim();
        return Boolean(sr || sn);
      });

      setItems(onlySpan);
      setTotal(res.data.total);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="pageHeader">
        <h2>Parallel Norm</h2>
        <div className="smallMuted">View-only span-level dataset</div>
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
        <ParallelNormTable items={items} loading={loading} />

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
    </div>
  );
}