import { useEffect, useState } from "react";
import { api } from "../api/client";
import "./OverviewPage.css";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const RATE_PER_HOUR = 8; // USD per verified hour

const fmtHours = (h = 0) => {
  const hrs  = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const fmtPay = (hours = 0) => `$${(hours * RATE_PER_HOUR).toFixed(2)}`;

// ─────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="ov-stat">
      <div className="ov-stat-label">{label}</div>
      <div className="ov-stat-value">{value}</div>
      {sub && <div className="ov-stat-sub">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOURS BAR
// ─────────────────────────────────────────────────────────────────

function HoursBar({ rank, name, email, hours, maxHours }) {
  const pct = maxHours > 0 ? (hours / maxHours) * 100 : 0;
  return (
    <div className="ov-bar-row">
      <div className="ov-bar-rank">#{rank + 1}</div>
      <div className="ov-bar-name-col">
        <div className="ov-bar-name">{name}</div>
        <div className="ov-bar-email">{email}</div>
      </div>
      <div className="ov-bar-track">
        <div className="ov-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ov-bar-value">{fmtHours(hours)}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAID TOGGLE BUTTON
// ─────────────────────────────────────────────────────────────────

function PaidToggle({ email, paid, onToggle, loading }) {
  return (
    <button
      className={`ov-paid-btn ${paid ? "ov-paid-btn-yes" : "ov-paid-btn-no"}`}
      onClick={() => onToggle(email, !paid)}
      disabled={loading}
    >
      {loading ? "..." : paid ? "Paid" : "Unpaid"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const [data,       setData]       = useState(null);
  const [audioStats, setAudioStats] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [payLoading, setPayLoading] = useState({}); // { email: bool }

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, audioRes] = await Promise.all([
        api.get("/api/overview"),
        api.get("/api/audio/stats"),
      ]);
      setData(overviewRes.data);
      setAudioStats(audioRes.data);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Toggle paid status for a student
  const handlePaid = async (email, paid) => {
    setPayLoading((prev) => ({ ...prev, [email]: true }));
    try {
      await api.patch(`/api/overview/pay/${encodeURIComponent(email)}`, { paid });
      // Update local state without full reload
      setData((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.email === email ? { ...s, paid } : s
        ),
      }));
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setPayLoading((prev) => ({ ...prev, [email]: false }));
    }
  };

  // ── loading ──
  if (loading) return (
    <div className="ov">
      <div className="ov-page-header">
        <h2 className="ov-title">Overview</h2>
      </div>
      <div className="ov-loading">Loading dashboard…</div>
    </div>
  );

  // ── error ──
  if (error && !data) return (
    <div className="ov">
      <div className="ov-page-header">
        <h2 className="ov-title">Overview</h2>
      </div>
      <div className="ov-alert-error">{error}</div>
      <button className="ov-btn" onClick={load}>↻ Retry</button>
    </div>
  );

  if (!data) return null;

  const { totals, students } = data;
  const maxHours  = Math.max(...students.map((s) => s.totalHours), 0.001);
  const totalPay  = totals.totalHours * RATE_PER_HOUR;
  const paidCount = students.filter((s) => s.paid).length;

  return (
    <div className="ov">

      {error && (
        <div className="ov-alert-error" onClick={() => setError("")}>
          {error} ×
        </div>
      )}

      {/* ── Header ── */}
      <div className="ov-page-header">
        <div>
          <h2 className="ov-title">Overview</h2>
          <p className="ov-sub">Admin dashboard — annotation progress &amp; student performance</p>
        </div>
        <button className="ov-btn" onClick={load}>↻ Refresh</button>
      </div>

      {/* ── Stat cards ── */}
      <div className="ov-stats-grid">
        <StatCard
          label="Total Files"
          value={audioStats?.total ?? "—"}
          sub="in dataset"
        />
        <StatCard
          label="Files Verified"
          value={audioStats?.verified ?? "—"}
          sub={audioStats
            ? `${Math.round((audioStats.verified / Math.max(audioStats.total, 1)) * 100)}% of dataset`
            : ""}
        />
        <StatCard
          label="Files Remaining"
          value={audioStats ? audioStats.total - audioStats.verified : "—"}
          sub="not yet verified"
        />
        <StatCard
          label="Hours Completed"
          value={fmtHours(totals.totalHours)}
          sub="verified work only"
        />
        <StatCard
          label="Total Payout"
          value={`$${totalPay.toFixed(2)}`}
          sub={`$${RATE_PER_HOUR}/hr · ${paidCount}/${students.length} paid`}
        />
        <StatCard
          label="Students"
          value={totals.students}
          sub="active annotators"
        />
      </div>

      {/* ── Hours bar chart ── */}
      <div className="ov-card">
        <div className="ov-card-head">
          <div className="ov-card-title">Hours Worked per Student</div>
          <div className="ov-card-sub">Verified tasks only · ranked by time</div>
        </div>
        <div className="ov-card-body">
          {students.length === 0 ? (
            <div className="ov-empty">No student data yet.</div>
          ) : (
            students.map((s, i) => (
              <HoursBar
                key={s.email}
                rank={i}
                name={s.name}
                email={s.email}
                hours={s.totalHours}
                maxHours={maxHours}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Students table ── */}
      <div className="ov-card" style={{ padding: 0 }}>
        <div className="ov-card-head">
          <div className="ov-card-title">Students</div>
          <div className="ov-card-sub">Performance summary · ${RATE_PER_HOUR} per verified hour</div>
        </div>
        <div className="ov-table-wrap">
          <table className="ov-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Name</th>
                <th>Files Done</th>
                <th>Hours Completed</th>
                <th>Payout</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ov-empty">No students yet.</td>
                </tr>
              ) : (
                students.map((s, i) => (
                  <tr key={s.email} className={s.paid ? "ov-row-paid" : ""}>
                    <td className="ov-td-rank">{i + 1}</td>
                    <td className="ov-td-email">{s.email}</td>
                    <td className="ov-td-name">{s.name}</td>
                    <td className="ov-td-num">{s.verified}</td>
                    <td className="ov-td-hours">{fmtHours(s.totalHours)}</td>
                    <td className="ov-td-pay">{fmtPay(s.totalHours)}</td>
                    <td>
                      <PaidToggle
                        email={s.email}
                        paid={s.paid}
                        onToggle={handlePaid}
                        loading={!!payLoading[s.email]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {students.length > 0 && (
              <tfoot>
                <tr className="ov-tfoot-row">
                  <td colSpan={4} className="ov-tfoot-label">Total</td>
                  <td className="ov-td-hours">{fmtHours(totals.totalHours)}</td>
                  <td className="ov-td-pay ov-td-pay-total">${totalPay.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}