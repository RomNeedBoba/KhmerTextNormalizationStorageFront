import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./DataValidation.css";

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const fmtCountdown = (ms) => {
  if (!ms || ms <= 0) return "Expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
};

const shortId = (id) => String(id).slice(-6).toUpperCase();

/**
 * Simple word-level diff
 * Returns array of {type: 'added'|'removed'|'same', text: string}
 */
function diffWords(original, modified) {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);

  // Simple algorithm: if lengths differ significantly, mark modified text as added
  if (Math.abs(origWords.length - modWords.length) > 5) {
    return [
      ...origWords.map(w => ({ type: 'removed', text: w })),
      ...modWords.map(w => ({ type: 'added', text: w }))
    ];
  }

  // Word-by-word comparison
  const result = [];
  const maxLen = Math.max(origWords.length, modWords.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origWords[i] || '';
    const mod = modWords[i] || '';

    if (orig === mod) {
      result.push({ type: 'same', text: orig });
    } else if (!orig) {
      result.push({ type: 'added', text: mod });
    } else if (!mod) {
      result.push({ type: 'removed', text: orig });
    } else {
      result.push({ type: 'removed', text: orig });
      result.push({ type: 'added', text: mod });
    }
  }

  return result;
}

/**
 * Render diff with colored spans
 */
function DiffHighlight({ original, modified }) {
  if (!original || !modified) {
    return <span>{modified || original}</span>;
  }

  if (original === modified) {
    return <span>{original}</span>;
  }

  const diff = diffWords(original, modified);

  return (
    <span>
      {diff.map((segment, idx) => {
        if (segment.type === 'same') {
          return <span key={idx}>{segment.text}</span>;
        } else if (segment.type === 'added') {
          return (
            <span key={idx} className="dv-diff-added" title="Added by student">
              {segment.text}
            </span>
          );
        } else {
          return (
            <span key={idx} className="dv-diff-removed" title="Removed from original">
              {segment.text}
            </span>
          );
        }
      })}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUDIO PLAYER
// ─────────────────────────────────────────────────────────────────

function AudioPlayer({ fileId }) {
  const audioRef                = useRef(null);
  const [blobUrl,  setBlobUrl]  = useState(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    let objectUrl = null;
    setLoading(true);
    setError("");

    api.get(`/api/audio/${fileId}/stream`, { responseType: "blob" })
      .then((res) => { objectUrl = URL.createObjectURL(res.data); setBlobUrl(objectUrl); })
      .catch(() => setError("Audio unavailable"))
      .finally(() => setLoading(false));

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !blobUrl) return;
    playing ? a.pause() : a.play();
    setPlaying(!playing);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const a    = audioRef.current;
    if (a?.duration) a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
  };

  const fmtTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  if (loading) return <div className="dv-player"><span className="dv-time">Loading audio…</span></div>;
  if (error)   return <div className="dv-player"><span className="dv-time dv-time-err">{error}</span></div>;

  return (
    <div className="dv-player">
      <audio
        ref={audioRef}
        src={blobUrl}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a?.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />
      <button className="dv-play-btn" onClick={toggle} disabled={!blobUrl}>
        {playing ? "⏸" : "▶"}
      </button>
      <div className="dv-track" onClick={seek}>
        <div className="dv-track-fill" style={{ width: `${progress}%` }} />
      </div>
      <span className="dv-time">
        {fmtTime(audioRef.current?.currentTime)} / {fmtTime(duration)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADMIN REVIEW CARD (WITH DIFF)
// ─────────────────────────────────────────────────────────────────

function AdminReviewCard({ file, onVerdict, isVerdicting }) {
  const [note, setNote] = useState("");
  const studentName = file.studentName || file.assignedTo || "Unknown";

  return (
    <div className="dv-review-card">

      {/* card header */}
      <div className="dv-review-head">
        <div className="dv-review-headleft">
          <span className="dv-id">#{shortId(file._id)}</span>
          <span className="dv-review-filename">{file.filename}</span>
          <span className="dv-review-folder">{file.movieFolder}</span>
        </div>
        <div className="dv-review-headright">
          <span className="dv-review-student">submitted by {studentName}</span>
        </div>
      </div>

      {/* audio */}
      <div className="dv-review-audio">
        <AudioPlayer fileId={file._id} />
      </div>

      {/* text comparison with DIFF */}
      <div className="dv-review-cols">

        <div className="dv-review-col">
          <div className="dv-review-col-head">
            <span className="dv-review-col-label">Raw Text</span>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Original</div>
            <div className="dv-review-text dv-review-text-original">
              {file.rawText || <em className="dv-no-text">No original text</em>}
            </div>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Student correction (diff highlighted)</div>
            <div className={`dv-review-text ${file.studentRawText ? "dv-review-text-student" : "dv-review-text-empty"}`}>
              {file.studentRawText ? (
                <DiffHighlight original={file.rawText || ""} modified={file.studentRawText} />
              ) : (
                <em className="dv-no-text">No correction</em>
              )}
            </div>
          </div>
        </div>

        <div className="dv-review-col">
          <div className="dv-review-col-head">
            <span className="dv-review-col-label">Normalized Text</span>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Original</div>
            <div className="dv-review-text dv-review-text-original">
              {file.normalizedText || <em className="dv-no-text">No original text</em>}
            </div>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Student correction (diff highlighted)</div>
            <div className={`dv-review-text ${file.studentNormalizedText ? "dv-review-text-student" : "dv-review-text-empty"}`}>
              {file.studentNormalizedText ? (
                <DiffHighlight original={file.normalizedText || ""} modified={file.studentNormalizedText} />
              ) : (
                <em className="dv-no-text">No correction</em>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* verdict footer */}
      <div className="dv-review-footer">
        <input
          className="dv-note-input"
          placeholder="Admin note (optional)…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="dv-verdict-btns">
          <button
            className="dv-btn dv-btn-accept"
            disabled={isVerdicting}
            onClick={() => onVerdict(file._id, "verified", note)}
          >
            ✓ Accept
          </button>
          <button
            className="dv-btn dv-btn-reject"
            disabled={isVerdicting}
            onClick={() => onVerdict(file._id, "rejected", note)}
          >
            ✗ Reject
          </button>
        </div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STUDENT FILE CARD
// ─────────────────────────────────────────────────────────────────

function FileCard({ file, onSubmit, isSubmitting }) {
  const [rawText,        setRawText]        = useState(file.studentRawText        || file.rawText        || "");
  const [normalizedText, setNormalizedText] = useState(file.studentNormalizedText || file.normalizedText || "");
  const isSubmitted = file.status === "submitted";

  // Only show countdown for assigned (in-progress) files — not submitted
  const showCountdown = file.status === "assigned" && file.expiresIn > 0;

  return (
    <div className={`dv-card ${isSubmitted ? "dv-card-submitted" : ""}`}>

      <div className="dv-card-head">
        <div className="dv-card-meta">
          <div className="dv-card-title-row">
            <span className="dv-filename">{file.filename}</span>
            <span className="dv-id">#{shortId(file._id)}</span>
          </div>
          <span className="dv-path">
            {file.movieFolder}{file.chapterFolder ? ` / ${file.chapterFolder}` : ""}
          </span>
        </div>
        <div className="dv-card-right">
          {/* countdown only shows when assigned, never when submitted */}
          {showCountdown && (
            <span className={`dv-countdown ${file.expiresIn < 3_600_000 ? "dv-countdown-warn" : ""}`}>
              {fmtCountdown(file.expiresIn)}
            </span>
          )}
          {isSubmitted && <span className="dv-badge-submitted">Submitted ✓</span>}
        </div>
      </div>

      <AudioPlayer fileId={file._id} />

      <div className="dv-fields">
        <div className="dv-field">
          <label>Raw Text</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={3}
            disabled={isSubmitted}
            placeholder="Raw text from transcript…"
          />
        </div>
        <div className="dv-field">
          <label>Normalized Text</label>
          <textarea
            value={normalizedText}
            onChange={(e) => setNormalizedText(e.target.value)}
            rows={3}
            disabled={isSubmitted}
            placeholder="Corrected normalized text…"
          />
        </div>
      </div>

      {!isSubmitted && (
        <div className="dv-card-footer">
          <button
            className="dv-submit-btn"
            onClick={() => onSubmit(file._id, { studentRawText: rawText, studentNormalizedText: normalizedText })}
            disabled={isSubmitting || !rawText.trim() || !normalizedText.trim()}
          >
            {isSubmitting ? "Submitting…" : "✓ Submit"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AVAILABLE ROW
// ─────────────────────────────────────────────────────────────────

function AvailableRow({ file, selected, onToggle }) {
  return (
    <div
      className={`dv-row ${selected ? "dv-row-selected" : ""}`}
      onClick={() => onToggle(file._id)}
    >
      <div className="dv-row-check">{selected ? "☑" : "☐"}</div>
      <div className="dv-row-id">#{shortId(file._id)}</div>
      <div className="dv-row-info">
        <span className="dv-filename">{file.filename}</span>
        <span className="dv-path">{file.movieFolder}{file.chapterFolder ? ` / ${file.chapterFolder}` : ""}</span>
      </div>
      <div className="dv-row-text">{file.rawText || <em>No text</em>}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function DataValidationPage() {
  const { user } = useAuth();
  const isAdmin  = user?.role === "admin";

  // ── student state ──
  const [tab,        setTab]        = useState("inprogress");
  const [myFiles,    setMyFiles]    = useState([]);
  const [available,  setAvailable]  = useState([]);
  const [avTotal,    setAvTotal]    = useState(0);
  const [avSearch,   setAvSearch]   = useState("");
  const [selected,   setSelected]   = useState([]);
  const [submitting, setSubmitting] = useState(null);
  const [assigning,  setAssigning]  = useState(false);

  // ── admin state ──
  const [adminFiles,  setAdminFiles]  = useState([]);
  const [adminTotal,  setAdminTotal]  = useState(0);
  const [adminPage,   setAdminPage]   = useState(1);
  const [adminStatus, setAdminStatus] = useState("submitted");
  const [adminSearch, setAdminSearch] = useState("");
  const [verdicting,  setVerdicting]  = useState(null);
  const [stats,       setStats]       = useState(null);

  // ── shared ──
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const LIMIT      = 20;
  const searchTimer = useRef(null);

  // ─────────────────────────────────────────────────────────────
  // LOADERS
  // ─────────────────────────────────────────────────────────────

  const loadMyFiles = async () => {
    try {
      const res = await api.get("/api/audio/my");
      setMyFiles(res.data.files || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  const loadAvailable = useCallback(async (q = "") => {
    try {
      setLoading(true);
      const res = await api.get("/api/audio/available", { params: { q: q || undefined, limit: 500 } });
      setAvailable(res.data.items || []);
      setAvTotal(res.data.total   || 0);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminFiles = async (page = 1, status = adminStatus, q = adminSearch) => {
    try {
      setLoading(true);
      const res = await api.get("/api/audio", { params: { page, limit: LIMIT, status, q: q || undefined } });
      setAdminFiles(res.data.items || []);
      setAdminTotal(res.data.total || 0);
      setAdminPage(page);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get("/api/audio/stats");
      setStats(res.data);
    } catch (e) {
      console.error("[DataValidation] loadStats:", e.message);
    }
  };

  useEffect(() => {
    if (isAdmin) { loadAdminFiles(1, "submitted"); loadStats(); }
    else         { loadMyFiles(); loadAvailable(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvSearch = (val) => {
    setAvSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadAvailable(val), 300);
  };

  const handleAdminSearch = (val) => {
    setAdminSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadAdminFiles(1, adminStatus, val), 300);
  };

  // ─────────────────────────────────────────────────────────────
  // STUDENT ACTIONS
  // ─────────────────────────────────────────────────────────────

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
        : prev.length >= 10 ? prev
        : [...prev, id]
    );
  };

  const handleAssign = async () => {
    if (!selected.length) return;
    setAssigning(true);
    setError("");
    try {
      const res = await api.post("/api/audio/assign", { fileIds: selected });
      setSuccess(`Assigned ${res.data.assigned} file(s).`);
      setSelected([]);
      await loadMyFiles();
      await loadAvailable(avSearch);
      setTab("my");
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleSubmit = async (fileId, payload) => {
    setSubmitting(fileId);
    setError("");
    try {
      await api.post(`/api/audio/${fileId}/submit`, payload);
      setSuccess("Submitted successfully.");
      await loadMyFiles();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSubmitting(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ADMIN ACTIONS
  // ─────────────────────────────────────────────────────────────

  const handleVerdict = async (fileId, verdict, adminNote = "") => {
    setVerdicting(fileId);
    setError("");
    try {
      await api.patch(`/api/audio/${fileId}/verify`, { verdict, adminNote });
      setSuccess(`File ${verdict}.`);
      await loadAdminFiles(adminPage, adminStatus, adminSearch);
      await loadStats();
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setVerdicting(null);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await api.get(`/api/audio/export?format=${format}`, { responseType: "blob" });
      const url  = URL.createObjectURL(res.data);
      const a    = document.createElement("a");
      a.href = url; a.download = `tts_dataset.${format}`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Export failed.");
    }
  };

  const adminTotalPages = Math.max(1, Math.ceil(adminTotal / LIMIT));

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="dv">

      {error   && <div className="dv-alert dv-alert-error"   onClick={() => setError("")}>{error} <span className="dv-alert-close">×</span></div>}
      {success && <div className="dv-alert dv-alert-success" onClick={() => setSuccess("")}>{success} <span className="dv-alert-close">×</span></div>}

      {/* ══════════════════════════════════════════════════════
          ADMIN VIEW
      ══════════════════════════════════════════════════════ */}
      {isAdmin && (
        <div>

          {/* header */}
          <div className="dv-page-header">
            <div>
              <h2 className="dv-title">Data Validation</h2>
              <p className="dv-sub">Listen to audio · compare original vs student correction · accept or reject</p>
            </div>
          </div>

          {/* stats */}
          {stats && (
            <div className="dv-stats">
              {[
                { label: "Total",     value: stats.total,     color: "#374151" },
                { label: "Available", value: stats.available, color: "#6b7280" },
                { label: "Assigned",  value: stats.assigned,  color: "#2563eb" },
                { label: "Submitted", value: stats.submitted, color: "#d97706" },
                { label: "Verified",  value: stats.verified,  color: "#16a34a" },
                { label: "Rejected",  value: stats.rejected,  color: "#dc2626" },
              ].map((s) => (
                <div className="dv-stat" key={s.label}>
                  <div className="dv-stat-label">{s.label}</div>
                  <div className="dv-stat-value" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* toolbar */}
          <div className="dv-toolbar">
            <div className="dv-tabs" style={{ border: "none", marginBottom: 0, flex: 1 }}>
              {["submitted", "verified", "available", "assigned", "rejected"].map((s) => (
                <button
                  key={s}
                  className={`dv-tab ${adminStatus === s ? "dv-tab-active" : ""}`}
                  onClick={() => { setAdminStatus(s); loadAdminFiles(1, s, adminSearch); }}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <input
              className="dv-search"
              placeholder="Search filename, text…"
              value={adminSearch}
              onChange={(e) => handleAdminSearch(e.target.value)}
            />
          </div>

          {/* review cards for submitted, table for others */}
          {loading ? (
            <div className="dv-loading">Loading…</div>
          ) : adminFiles.length === 0 ? (
            <div className="dv-empty">No files found.</div>
          ) : adminStatus === "submitted" ? (
            // ── Card view for review ──
            <div className="dv-review-list">
              {adminFiles.map((f) => (
                <AdminReviewCard
                  key={f._id}
                  file={f}
                  onVerdict={handleVerdict}
                  isVerdicting={verdicting === f._id}
                />
              ))}
            </div>
          ) : (
            // ── Table view for other statuses ──
            <div className="dv-table-wrap">
              <table className="dv-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>File</th>
                    <th>Folder</th>
                    <th>Student</th>
                    <th>Raw Text</th>
                    <th>Normalized Text</th>
                    <th>Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {adminFiles.map((f) => (
                    <tr key={f._id}>
                      <td className="dv-cell-id">#{shortId(f._id)}</td>
                      <td className="dv-cell-file">{f.filename}</td>
                      <td className="dv-cell-path">{f.movieFolder}</td>
                      <td className="dv-cell-student">{f.studentName || "—"}</td>
                      <td className="dv-cell-text-full">
                        <DiffHighlight original={f.rawText || ""} modified={f.studentRawText || ""} />
                      </td>
                      <td className="dv-cell-text-full">
                        <DiffHighlight original={f.normalizedText || ""} modified={f.studentNormalizedText || ""} />
                      </td>
                      <td><AudioPlayer fileId={f._id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* pager */}
          <div className="dv-pager">
            <button className="dv-btn" disabled={adminPage <= 1} onClick={() => loadAdminFiles(adminPage - 1, adminStatus, adminSearch)}>Prev</button>
            <span className="dv-page-info">Page {adminPage} / {adminTotalPages} · {adminTotal} files</span>
            <button className="dv-btn" disabled={adminPage >= adminTotalPages} onClick={() => loadAdminFiles(adminPage + 1, adminStatus, adminSearch)}>Next</button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          STUDENT VIEW
      ══════════════════════════════════════════════════════ */}
      {!isAdmin && (
        <div>

          <div className="dv-page-header">
            <div>
              <h2 className="dv-title">Data Validation</h2>
              <p className="dv-sub">Listen · correct · submit · max 10 files per day</p>
            </div>
          </div>

          {/* 3 tabs */}
          <div className="dv-tabs">
            <button
              className={`dv-tab ${tab === "inprogress" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("inprogress")}
            >
              In Progress
              {myFiles.filter(f => f.status === "assigned").length > 0 && (
                <span className="dv-tab-count">
                  {myFiles.filter(f => f.status === "assigned").length}
                </span>
              )}
            </button>
            <button
              className={`dv-tab ${tab === "submitted" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("submitted")}
            >
              Submitted
              {myFiles.filter(f => f.status === "submitted").length > 0 && (
                <span className="dv-tab-count">
                  {myFiles.filter(f => f.status === "submitted").length}
                </span>
              )}
            </button>
            <button
              className={`dv-tab ${tab === "available" ? "dv-tab-active" : ""}`}
              onClick={() => { setTab("available"); loadAvailable(avSearch); }}
            >
              Available
              <span className="dv-tab-count">{avTotal}</span>
            </button>
          </div>

          {/* ── In Progress ── */}
          {tab === "inprogress" && (() => {
            const inProgress = myFiles.filter(f => f.status === "assigned");
            return inProgress.length === 0 ? (
              <div className="dv-empty">
                No files in progress. Go to Available to pick some.
              </div>
            ) : (
              <div>
                {inProgress.map((f) => (
                  <FileCard
                    key={f._id}
                    file={f}
                    onSubmit={handleSubmit}
                    isSubmitting={submitting === f._id}
                  />
                ))}
              </div>
            );
          })()}

          {/* ── Submitted — read-only view ── */}
          {tab === "submitted" && (() => {
            const submitted = myFiles.filter(f => f.status === "submitted");
            return submitted.length === 0 ? (
              <div className="dv-empty">
                No submitted files yet. Submit a file from In Progress to see it here.
              </div>
            ) : (
              <div>
                {submitted.map((f) => (
                  <div key={f._id} className="dv-submitted-item">
                    <div className="dv-submitted-head">
                      <div className="dv-submitted-headleft">
                        <span className="dv-filename">{f.filename}</span>
                        <span className="dv-id">#{shortId(f._id)}</span>
                        <span className="dv-path">{f.movieFolder}{f.chapterFolder ? ` / ${f.chapterFolder}` : ""}</span>
                      </div>
                      <span className="dv-badge-submitted">Submitted ✓</span>
                    </div>
                    <AudioPlayer fileId={f._id} />
                    <div className="dv-submitted-texts">
                      <div className="dv-submitted-col">
                        <div className="dv-submitted-label">Raw Text</div>
                        <div className="dv-submitted-text">
                          <DiffHighlight original={f.rawText || ""} modified={f.studentRawText || ""} />
                        </div>
                      </div>
                      <div className="dv-submitted-col">
                        <div className="dv-submitted-label">Normalized Text</div>
                        <div className="dv-submitted-text">
                          <DiffHighlight original={f.normalizedText || ""} modified={f.studentNormalizedText || ""} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Available ── */}
          {tab === "available" && (
            <div>
              <div className="dv-toolbar">
                <input
                  className="dv-search"
                  placeholder="Search filename or text…"
                  value={avSearch}
                  onChange={(e) => handleAvSearch(e.target.value)}
                />
                {selected.length > 0 && (
                  <button
                    className="dv-btn dv-btn-assign"
                    onClick={handleAssign}
                    disabled={assigning}
                  >
                    {assigning ? "Assigning…" : `Assign ${selected.length} file(s)`}
                  </button>
                )}
              </div>

              {selected.length > 0 && (
                <div className="dv-assign-bar">
                  <span>{selected.length} selected (max 10)</span>
                  <button className="dv-btn" onClick={() => setSelected([])}>Clear</button>
                </div>
              )}

              {loading ? (
                <div className="dv-loading">Loading…</div>
              ) : available.length === 0 ? (
                <div className="dv-empty">No available files.</div>
              ) : (
                <div className="dv-available-list">
                  {available.map((f) => (
                    <AvailableRow
                      key={f._id}
                      file={f}
                      selected={selected.includes(f._id)}
                      onToggle={toggleSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
