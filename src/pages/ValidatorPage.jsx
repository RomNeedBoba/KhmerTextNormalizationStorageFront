import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./ValidatorPage.css";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtDate = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function ValidatorPage() {
  const { token } = useAuth();
  const [validators, setValidators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("total"); // total, approved, rejected, approval-rate

  const load = async () => {
    setLoading(true);
    setError("");
    
    try {
      const res = await api.get("/api/audio/validators");
      setValidators(res.data.validators || []);
      console.log("✅ Validators loaded:", res.data.validators?.length);
    } catch (e) {
      const message = e?.response?.data?.message || e.message || "Failed to load validators.";
      console.error("❌ Load error:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      load();
    }
  }, [token]);

  const getSortedValidators = () => {
    const sorted = [...validators];
    
    switch (sortBy) {
      case "total":
        return sorted.sort((a, b) => b.totalCount - a.totalCount);
      case "approved":
        return sorted.sort((a, b) => b.approvedCount - a.approvedCount);
      case "rejected":
        return sorted.sort((a, b) => b.rejectedCount - a.rejectedCount);
      case "approval-rate":
        return sorted.sort((a, b) => parseFloat(b.approvalRate) - parseFloat(a.approvalRate));
      default:
        return sorted;
    }
  };

  if (loading) return (
    <div className="val">
      <div className="val-page-header">
        <h2 className="val-title">Validators</h2>
      </div>
      <div className="val-loading">Loading validators…</div>
    </div>
  );

  if (error && validators.length === 0) return (
    <div className="val">
      <div className="val-page-header">
        <h2 className="val-title">Validators</h2>
      </div>
      <div className="val-alert-error">{error}</div>
      <button className="val-btn" onClick={load}>↻ Retry</button>
    </div>
  );

  const sortedValidators = getSortedValidators();
  const totalApproved = validators.reduce((sum, v) => sum + v.approvedCount, 0);
  const totalRejected = validators.reduce((sum, v) => sum + v.rejectedCount, 0);
  const totalReviewed = totalApproved + totalRejected;

  return (
    <div className="val">

      {error && (
        <div className="val-alert-error" onClick={() => setError("")}>
          {error} ×
        </div>
      )}

      {/* ── Header ── */}
      <div className="val-page-header">
        <div>
          <h2 className="val-title">Validators</h2>
          <p className="val-sub">Admin review — validator performance &amp; approval statistics</p>
        </div>
        <button className="val-btn" onClick={load}>↻ Refresh</button>
      </div>

      {/* ── Summary Stats ── */}
      <div className="val-stats-grid">
        <div className="val-stat">
          <div className="val-stat-label">Total Validators</div>
          <div className="val-stat-value">{validators.length}</div>
          <div className="val-stat-sub">active reviewers</div>
        </div>
        <div className="val-stat">
          <div className="val-stat-label">Files Approved</div>
          <div className="val-stat-value">{totalApproved}</div>
          <div className="val-stat-sub">verified files</div>
        </div>
        <div className="val-stat">
          <div className="val-stat-label">Files Rejected</div>
          <div className="val-stat-value">{totalRejected}</div>
          <div className="val-stat-sub">needs rework</div>
        </div>
        <div className="val-stat">
          <div className="val-stat-label">Total Reviewed</div>
          <div className="val-stat-value">{totalReviewed}</div>
          <div className="val-stat-sub">overall approval rate: {totalReviewed > 0 ? ((totalApproved / totalReviewed) * 100).toFixed(1) : "—"}%</div>
        </div>
      </div>

      {/* ── Validators Table ── */}
      <div className="val-card" style={{ padding: 0 }}>
        <div className="val-card-head">
          <div className="val-card-title">Validator Performance</div>
          <div className="val-card-sub">Review history &amp; approval metrics</div>
        </div>

        {/* Sort Controls */}
        <div className="val-sort-controls">
          <button
            className={`val-sort-btn ${sortBy === "total" ? "val-sort-active" : ""}`}
            onClick={() => setSortBy("total")}
          >
            By Total
          </button>
          <button
            className={`val-sort-btn ${sortBy === "approved" ? "val-sort-active" : ""}`}
            onClick={() => setSortBy("approved")}
          >
            By Approved
          </button>
          <button
            className={`val-sort-btn ${sortBy === "rejected" ? "val-sort-active" : ""}`}
            onClick={() => setSortBy("rejected")}
          >
            By Rejected
          </button>
          <button
            className={`val-sort-btn ${sortBy === "approval-rate" ? "val-sort-active" : ""}`}
            onClick={() => setSortBy("approval-rate")}
          >
            By Approval Rate
          </button>
        </div>

        <div className="val-table-wrap">
          <table className="val-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Name</th>
                <th>Approved</th>
                <th>Rejected</th>
                <th>Total</th>
                <th>Approval Rate</th>
                <th>Last Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedValidators.length === 0 ? (
                <tr>
                  <td colSpan={8} className="val-empty">No validators yet.</td>
                </tr>
              ) : (
                sortedValidators.map((v, i) => (
                  <tr key={v.email}>
                    <td className="val-td-rank">{i + 1}</td>
                    <td className="val-td-email">{v.email}</td>
                    <td className="val-td-name">{v.name}</td>
                    <td className="val-td-approved">
                      <span className="val-badge val-badge-approved">{v.approvedCount}</span>
                    </td>
                    <td className="val-td-rejected">
                      <span className="val-badge val-badge-rejected">{v.rejectedCount}</span>
                    </td>
                    <td className="val-td-total">
                      <strong>{v.totalCount}</strong>
                    </td>
                    <td className="val-td-rate">
                      <div className="val-rate-bar">
                        <div 
                          className="val-rate-fill" 
                          style={{ width: `${v.approvalRate}%` }}
                        />
                        <span className="val-rate-text">{v.approvalRate}%</span>
                      </div>
                    </td>
                    <td className="val-td-date">{fmtDate(v.lastAction)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}