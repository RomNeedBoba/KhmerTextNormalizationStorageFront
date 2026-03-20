import { useEffect, useState } from "react";
import { api } from "../api/client";
import "./StudentStatus.css";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month:  "short",
    day:    "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
};

const fmtCountdown = (ms) => {
  if (!ms || ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
};

// ─────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    assigned:  { label: "In Progress", className: "ss-badge ss-badge-assigned"  },
    submitted: { label: "Pending",     className: "ss-badge ss-badge-submitted" },
    verified:  { label: "Verified",    className: "ss-badge ss-badge-verified"  },
    rejected:  { label: "Rejected",    className: "ss-badge ss-badge-rejected"  },
  };
  const s = map[status] || { label: status, className: "ss-badge" };
  return <span className={s.className}>{s.label}</span>;
}

// ─────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, className }) {
  return (
    <div className={`ss-stat ${className}`}>
      <div className="ss-stat-value">{value}</div>
      <div className="ss-stat-label">{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function StudentStatusPage() {
  const [data,    setData]    = useState(null);
  const [filter,  setFilter]  = useState("all"); // "all" | "assigned" | "submitted" | "verified" | "rejected"
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/api/audio/my/status");
      setData(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = data?.files?.filter((f) =>
    filter === "all" ? true : f.status === filter
  ) || [];

  const tabs = [
    { key: "all",       label: "All"         },
    { key: "assigned",  label: "In Progress" },
    { key: "submitted", label: "Pending"     },
    { key: "verified",  label: "Verified"    },
    { key: "rejected",  label: "Rejected"    },
  ];

  // ── loading ──
  if (loading) {
    return (
      <div className="ss">
        <div className="ss-page-header">
          <h2 className="ss-title">My Status</h2>
        </div>
        <div className="ss-loading">Loading your tasks…</div>
      </div>
    );
  }

  // ── error ──
  if (error) {
    return (
      <div className="ss">
        <div className="ss-page-header">
          <h2 className="ss-title">My Status</h2>
        </div>
        <div className="ss-alert-error">{error}</div>
        <button className="ss-btn" onClick={load}>↻ Retry</button>
      </div>
    );
  }

  const counts = data?.counts || { assigned: 0, submitted: 0, verified: 0, rejected: 0 };
  const total  = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ss">

      {/* page header */}
      <div className="ss-page-header">
        <div>
          <h2 className="ss-title">My Status</h2>
          <p className="ss-sub">Track all your annotation tasks and their outcomes</p>
        </div>
        <button className="ss-btn" onClick={load}>↻ Refresh</button>
      </div>

      {/* stat cards */}
      <div className="ss-stats">
        <StatCard label="Total Tasks"  value={total}              className="ss-stat-total"    />
        <StatCard label="In Progress"  value={counts.assigned}    className="ss-stat-assigned"  />
        <StatCard label="Pending Review" value={counts.submitted} className="ss-stat-submitted" />
        <StatCard label="Verified"     value={counts.verified}    className="ss-stat-verified"  />
        <StatCard label="Rejected"     value={counts.rejected}    className="ss-stat-rejected"  />
      </div>

      {/* progress bar */}
      {total > 0 && (
        <div className="ss-progress-wrap">
          <div className="ss-progress-bar">
            {counts.verified > 0 && (
              <div
                className="ss-progress-fill ss-fill-verified"
                style={{ width: `${(counts.verified / total) * 100}%` }}
                title={`Verified: ${counts.verified}`}
              />
            )}
            {counts.submitted > 0 && (
              <div
                className="ss-progress-fill ss-fill-submitted"
                style={{ width: `${(counts.submitted / total) * 100}%` }}
                title={`Pending: ${counts.submitted}`}
              />
            )}
            {counts.assigned > 0 && (
              <div
                className="ss-progress-fill ss-fill-assigned"
                style={{ width: `${(counts.assigned / total) * 100}%` }}
                title={`In Progress: ${counts.assigned}`}
              />
            )}
            {counts.rejected > 0 && (
              <div
                className="ss-progress-fill ss-fill-rejected"
                style={{ width: `${(counts.rejected / total) * 100}%` }}
                title={`Rejected: ${counts.rejected}`}
              />
            )}
          </div>
          <div className="ss-progress-legend">
            <span className="ss-legend-dot ss-dot-verified" /> Verified
            <span className="ss-legend-dot ss-dot-submitted" /> Pending
            <span className="ss-legend-dot ss-dot-assigned" /> In Progress
            <span className="ss-legend-dot ss-dot-rejected" /> Rejected
          </div>
        </div>
      )}

      {/* filter tabs */}
      <div className="ss-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`ss-tab ${filter === t.key ? "ss-tab-active" : ""}`}
            onClick={() => setFilter(t.key)}
          >
            {t.label}
            {t.key !== "all" && counts[t.key] > 0 && (
              <span className="ss-tab-count">{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* file list */}
      {filtered.length === 0 ? (
        <div className="ss-empty">No tasks found for this filter.</div>
      ) : (
        <div className="ss-list">
          {filtered.map((f) => (
            <div key={f._id} className={`ss-item ss-item-${f.status}`}>

              {/* left: file info */}
              <div className="ss-item-info">
                <div className="ss-item-filename">{f.filename}</div>
                <div className="ss-item-folder">
                  {f.movieFolder}{f.chapterFolder ? ` / ${f.chapterFolder}` : ""}
                </div>
              </div>

              {/* middle: text preview */}
              <div className="ss-item-text">
                {f.studentRawText
                  ? <span className="ss-item-corrected">{f.studentRawText}</span>
                  : <span className="ss-item-original">{f.rawText || "No text"}</span>
                }
              </div>

              {/* right: status + dates */}
              <div className="ss-item-right">
                <StatusBadge status={f.status} />

                <div className="ss-item-dates">
                  {f.assignedAt  && <span>Assigned {fmtDate(f.assignedAt)}</span>}
                  {f.submittedAt && <span>Submitted {fmtDate(f.submittedAt)}</span>}
                  {f.verifiedAt  && <span>Verified {fmtDate(f.verifiedAt)}</span>}
                  {f.status === "assigned" && f.expiresIn !== null && (
                    <span className={f.expiresIn < 3_600_000 ? "ss-expire-warn" : "ss-expire"}>
                      {fmtCountdown(f.expiresIn)}
                    </span>
                  )}
                </div>

                {/* admin note on rejection */}
                {f.status === "rejected" && f.adminNote && (
                  <div className="ss-admin-note">
                    Note: {f.adminNote}
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}