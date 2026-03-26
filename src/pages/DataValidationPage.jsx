import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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

function diffWords(original, modified) {
  const origWords = original.split(/(\s+)/);
  const modWords = modified.split(/(\s+)/);

  if (Math.abs(origWords.length - modWords.length) > 5) {
    return [
      ...origWords.map(w => ({ type: 'removed', text: w })),
      ...modWords.map(w => ({ type: 'added', text: w }))
    ];
  }

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
            <span key={idx} className="dv-diff-added">
              {segment.text}
            </span>
          );
        } else {
          return (
            <span key={idx} className="dv-diff-removed">
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
  const audioRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let objectUrl = null;
    setLoading(true);
    setError("");

    const loadAudio = async () => {
      try {
        const res = await api.get(`/api/audio/${fileId}/stream`, { 
          responseType: "blob" 
        });
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch (e) {
        setError("Audio unavailable");
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !blobUrl) return;
    playing ? a.pause() : a.play();
    setPlaying(!playing);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const a = audioRef.current;
    if (a?.duration) a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
  };

  const fmtTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  if (loading) return (
    <div className="dv-player">
      <span className="dv-time">Loading…</span>
    </div>
  );

  if (error) return (
    <div className="dv-player">
      <span className="dv-time dv-time-err">{error}</span>
    </div>
  );

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
// ADMIN REVIEW CARD (Memoized for performance)
// ─────────────────────────────────────────────────────────────────

const AdminReviewCard = React.memo(function AdminReviewCard({ file, onVerdict, isVerdicting }) {
  const [note, setNote] = useState("");
  const studentName = file.studentName || file.assignedTo || "Unknown";

  return (
    <div className="dv-review-card">
      <div className="dv-review-head">
        <div className="dv-review-headleft">
          <span className="dv-id">#{shortId(file._id)}</span>
          <span className="dv-review-filename">{file.filename}</span>
          <span className="dv-review-folder">{file.movieFolder}</span>
        </div>
        <div className="dv-review-headright">
          <span className="dv-review-student">by {studentName}</span>
        </div>
      </div>

      <div className="dv-review-audio">
        <AudioPlayer fileId={file._id} />
      </div>

      <div className="dv-review-cols">
        <div className="dv-review-col">
          <div className="dv-review-col-head">
            <span className="dv-review-col-label">Raw Text</span>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Original</div>
            <div className="dv-review-text dv-review-text-original">
              {file.rawText || <em className="dv-no-text">No text</em>}
            </div>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Correction</div>
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
              {file.normalizedText || <em className="dv-no-text">No text</em>}
            </div>
          </div>
          <div className="dv-review-col-section">
            <div className="dv-review-col-sublabel">Correction</div>
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

      <div className="dv-review-footer">
        <input
          className="dv-note-input"
          placeholder="Admin note…"
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
});

// ─────────────────────────────────────────────────────────────────
// STUDENT FILE CARD (Memoized)
// ─────────────────────────────────────────────────────────────────

const FileCard = React.memo(function FileCard({ file, onSubmit, isSubmitting }) {
  const [rawText, setRawText] = useState(file.studentRawText || file.rawText || "");
  const [normalizedText, setNormalizedText] = useState(file.studentNormalizedText || file.normalizedText || "");
  const isSubmitted = file.status === "submitted";
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
            placeholder="Raw text…"
          />
        </div>
        <div className="dv-field">
          <label>Normalized Text</label>
          <textarea
            value={normalizedText}
            onChange={(e) => setNormalizedText(e.target.value)}
            rows={3}
            disabled={isSubmitted}
            placeholder="Normalized text…"
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
});

// ─────────────────────────────────────────────────────────────────
// AVAILABLE ROW (Memoized)
// ─────────────────────────────────────────────────────────────────

const AvailableRow = React.memo(function AvailableRow({ file, selected, onToggle }) {
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
});

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────

export default function DataValidationPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // ── student state ──
  const [tab, setTab] = useState("inprogress");
  const [myFiles, setMyFiles] = useState([]);
  const [available, setAvailable] = useState([]);
  const [avTotal, setAvTotal] = useState(0);
  const [avSearch, setAvSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [submitting, setSubmitting] = useState(null);
  const [assigning, setAssigning] = useState(false);

  // ── admin state ──
  const [adminFiles, setAdminFiles] = useState([]);
  const [adminTotal, setAdminTotal] = useState(0);
  const [adminPage, setAdminPage] = useState(1);
  const [adminStatus, setAdminStatus] = useState("submitted");
  const [adminSearch, setAdminSearch] = useState("");
  const [verdicting, setVerdicting] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── shared ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const LIMIT = 20;
  const searchTimer = useRef(null);

  // ─────────────────────────────────────────────────────────────
  // LOADERS
  // ─────────────────────────────────────────────────────────────

  const loadMyFiles = useCallback(async () => {
    try {
      const res = await api.get("/api/audio/my");
      setMyFiles(res.data.files || []);
    } catch (e) {
      console.error("loadMyFiles error:", e.message);
    }
  }, []);

  const loadAvailable = useCallback(async (q = "") => {
    try {
      setLoading(true);
      const res = await api.get("/api/audio/available", { params: { q: q || undefined, limit: 500 } });
      setAvailable(res.data.items || []);
      setAvTotal(res.data.total || 0);
    } catch (e) {
      console.error("loadAvailable error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminFiles = useCallback(async (page = 1, status = "submitted", q = "") => {
    try {
      setLoading(true);
      const res = await api.get("/api/audio", { params: { page, limit: LIMIT, status, q: q || undefined } });
      setAdminFiles(res.data.items || []);
      setAdminTotal(res.data.total || 0);
      setAdminPage(page);
    } catch (e) {
      console.error("loadAdminFiles error:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await api.get("/api/audio/stats");
      setStats(res.data);
    } catch (e) {
      console.error("loadStats error:", e.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ✅ Only load on mount
  useEffect(() => {
    if (isAdmin) {
      loadAdminFiles(1, "submitted", "");
      loadStats();
    } else {
      loadMyFiles();
      loadAvailable("");
    }
  }, [isAdmin, loadAdminFiles, loadMyFiles, loadAvailable, loadStats]);

  // ─────────────────────────────────────────────────────────────
  // SEARCH (Debounced)
  // ─────────────────────────────────────────────────────────────

  const handleAvSearch = useCallback((val) => {
    setAvSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadAvailable(val), 300);
  }, [loadAvailable]);

  const handleAdminSearch = useCallback((val) => {
    setAdminSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadAdminFiles(1, adminStatus, val), 300);
  }, [loadAdminFiles, adminStatus]);

  const handleStatusChange = useCallback((newStatus) => {
    setAdminStatus(newStatus);
    loadAdminFiles(1, newStatus, adminSearch);
  }, [loadAdminFiles, adminSearch]);

  // ─────────────────────────────────────────────────────────────
  // STUDENT ACTIONS - SUPER OPTIMIZED
  // ─────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
        : prev.length >= 10 ? prev
        : [...prev, id]
    );
  }, []);

  const handleAssign = useCallback(async () => {
    if (!selected.length) return;

    const selectedItems = available.filter((f) => selected.includes(f._id));
    const originalState = { available, myFiles, avTotal };

    // ✅ Instant optimistic update
    setAvailable((prev) => prev.filter((f) => !selected.includes(f._id)));
    setMyFiles((prev) => [
      ...prev,
      ...selectedItems.map((f) => ({
        ...f,
        status: "assigned",
        assignedAt: new Date(),
        expiresIn: 24 * 60 * 60 * 1000,
      })),
    ]);
    setAvTotal((prev) => Math.max(0, prev - selected.length));
    setSelected([]);
    setAssigning(true);
    setError("");
    setTab("inprogress");

    try {
      await api.post("/api/audio/assign", { fileIds: selected });
      setSuccess(`Assigned ${selected.length} file(s).`);
    } catch (e) {
      setAvailable(originalState.available);
      setMyFiles(originalState.myFiles);
      setAvTotal(originalState.avTotal);
      setError(e?.response?.data?.message || e.message);
      setTab("available");
    } finally {
      setAssigning(false);
    }
  }, [selected, available, myFiles, avTotal]);

  const handleSubmit = useCallback(async (fileId, payload) => {
    const originalFiles = myFiles;

    // ✅ Instant UI update
    setMyFiles((prev) =>
      prev.map((f) =>
        f._id === fileId
          ? {
              ...f,
              status: "submitted",
              studentRawText: payload.studentRawText,
              studentNormalizedText: payload.studentNormalizedText,
              submittedAt: new Date(),
            }
          : f
      )
    );
    setSubmitting(fileId);
    setError("");

    try {
      await api.post(`/api/audio/${fileId}/submit`, payload);
      setSuccess("Submitted!");
    } catch (e) {
      setMyFiles(originalFiles);
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSubmitting(null);
    }
  }, [myFiles]);

  // ─────────────────────────────────────────────────────────────
  // ADMIN ACTIONS - SUPER OPTIMIZED
  // ─────────────────────────────────────────────────────────────

  const handleVerdict = useCallback(async (fileId, verdict, adminNote = "") => {
    const originalFiles = adminFiles;

    // ✅ Instant removal from UI
    setAdminFiles((prev) => prev.filter((f) => f._id !== fileId));
    setVerdicting(fileId);
    setError("");

    // ✅ Update stats optimistically
    setStats((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        submitted: prev.submitted - 1,
        [verdict]: prev[verdict] + 1,
        total: prev.total,
      };
    });

    try {
      await api.patch(`/api/audio/${fileId}/verify`, { verdict, adminNote });
      setSuccess(`File ${verdict}!`);
    } catch (e) {
      // Rollback
      setAdminFiles(originalFiles);
      setStats((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submitted: prev.submitted + 1,
          [verdict]: prev[verdict] - 1,
          total: prev.total,
        };
      });
      setError(e?.response?.data?.message || e.message);
    } finally {
      setVerdicting(null);
    }
  }, [adminFiles]);

  const handleExport = useCallback(async (format) => {
    try {
      const res = await api.get(`/api/audio/export?format=${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tts_dataset.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Export failed.");
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // MEMOIZED COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────

  const adminTotalPages = useMemo(() => Math.max(1, Math.ceil(adminTotal / LIMIT)), [adminTotal]);

  const inProgressFiles = useMemo(() => myFiles.filter((f) => f.status === "assigned"), [myFiles]);
  const submittedFiles = useMemo(() => myFiles.filter((f) => f.status === "submitted"), [myFiles]);

  // ──────────────────────────���──────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (!user) return <div className="dv-loading">Loading…</div>;

  return (
    <div className="dv">
      {error && (
        <div className="dv-alert dv-alert-error" onClick={() => setError("")}>
          {error} <span className="dv-alert-close">×</span>
        </div>
      )}
      {success && (
        <div className="dv-alert dv-alert-success" onClick={() => setSuccess("")}>
          {success} <span className="dv-alert-close">×</span>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          ADMIN VIEW
      ══════════════════════════════════════════════════════ */}
      {isAdmin && (
        <div>
          <div className="dv-page-header">
            <div>
              <h2 className="dv-title">Data Validation</h2>
              <p className="dv-sub">Listen · compare · accept/reject</p>
            </div>
          </div>

          {stats && (
            <div className="dv-stats">
              {[
                { label: "Total", value: stats.total, color: "#374151" },
                { label: "Available", value: stats.available, color: "#6b7280" },
                { label: "Assigned", value: stats.assigned, color: "#2563eb" },
                { label: "Submitted", value: stats.submitted, color: "#d97706" },
                { label: "Verified", value: stats.verified, color: "#16a34a" },
                { label: "Rejected", value: stats.rejected, color: "#dc2626" },
              ].map((s) => (
                <div className="dv-stat" key={s.label}>
                  <div className="dv-stat-label">{s.label}</div>
                  <div className="dv-stat-value" style={{ color: s.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="dv-toolbar">
            <div className="dv-tabs" style={{ border: "none", marginBottom: 0, flex: 1 }}>
              {["submitted", "verified", "available", "assigned", "rejected"].map((s) => (
                <button
                  key={s}
                  className={`dv-tab ${adminStatus === s ? "dv-tab-active" : ""}`}
                  onClick={() => handleStatusChange(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <input
              className="dv-search"
              placeholder="Search…"
              value={adminSearch}
              onChange={(e) => handleAdminSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="dv-loading">Loading…</div>
          ) : adminFiles.length === 0 ? (
            <div className="dv-empty">No files found.</div>
          ) : adminStatus === "submitted" ? (
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
            <div className="dv-table-wrap">
              <table className="dv-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>File</th>
                    <th>Folder</th>
                    <th>Student</th>
                    <th>Raw Text</th>
                    <th>Normalized</th>
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

          <div className="dv-pager">
            <button
              className="dv-btn"
              disabled={adminPage <= 1}
              onClick={() => loadAdminFiles(adminPage - 1, adminStatus, adminSearch)}
            >
              Prev
            </button>
            <span className="dv-page-info">
              Page {adminPage} / {adminTotalPages}
            </span>
            <button
              className="dv-btn"
              disabled={adminPage >= adminTotalPages}
              onClick={() => loadAdminFiles(adminPage + 1, adminStatus, adminSearch)}
            >
              Next
            </button>

            <div style={{ flex: 1 }} />

            <button className="dv-btn" onClick={() => handleExport("json")}>Export JSON</button>
            <button className="dv-btn" onClick={() => handleExport("csv")}>Export CSV</button>
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
              <p className="dv-sub">Listen · correct · submit</p>
            </div>
          </div>

          <div className="dv-tabs">
            <button
              className={`dv-tab ${tab === "inprogress" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("inprogress")}
            >
              In Progress
              {inProgressFiles.length > 0 && (
                <span className="dv-tab-count">{inProgressFiles.length}</span>
              )}
            </button>

            <button
              className={`dv-tab ${tab === "submitted" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("submitted")}
            >
              Submitted
              {submittedFiles.length > 0 && (
                <span className="dv-tab-count">{submittedFiles.length}</span>
              )}
            </button>

            <button
              className={`dv-tab ${tab === "available" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("available")}
            >
              Available <span className="dv-tab-count">{avTotal}</span>
            </button>
          </div>

          {tab === "inprogress" && (
            <>
              {inProgressFiles.length === 0 ? (
                <div className="dv-empty">No files in progress.</div>
              ) : (
                <div>
                  {inProgressFiles.map((f) => (
                    <FileCard
                      key={f._id}
                      file={f}
                      onSubmit={handleSubmit}
                      isSubmitting={submitting === f._id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "submitted" && (
            <>
              {submittedFiles.length === 0 ? (
                <div className="dv-empty">No submitted files.</div>
              ) : (
                <div>
                  {submittedFiles.map((f) => (
                    <div key={f._id} className="dv-submitted-item">
                      <div className="dv-submitted-head">
                        <div className="dv-submitted-headleft">
                          <span className="dv-filename">{f.filename}</span>
                          <span className="dv-id">#{shortId(f._id)}</span>
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
              )}
            </>
          )}

          {tab === "available" && (
            <div>
              <div className="dv-toolbar">
                <input
                  className="dv-search"
                  placeholder="Search…"
                  value={avSearch}
                  onChange={(e) => handleAvSearch(e.target.value)}
                />
                {selected.length > 0 && (
                  <button
                    className="dv-btn dv-btn-assign"
                    onClick={handleAssign}
                    disabled={assigning}
                  >
                    {assigning ? "Assigning…" : `Assign ${selected.length}`}
                  </button>
                )}
              </div>

              {selected.length > 0 && (
                <div className="dv-assign-bar">
                  <span>{selected.length}/10 selected</span>
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
