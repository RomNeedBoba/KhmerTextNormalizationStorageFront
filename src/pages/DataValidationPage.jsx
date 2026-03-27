import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import "./DataValidation.css";

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const EXPIRE_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 10;
const LIMIT = 20;
const SEARCH_DEBOUNCE = 300;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────────
// AUDIO LOADING QUEUE (Prevent concurrent request overload)
// ─────────────────────────────────────────────────────────────────

class AudioLoadQueue {
  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
  }

  async load(_fileId, loaderFn) {
    while (this.activeCount >= this.maxConcurrent) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.activeCount++;
    try {
      return await loaderFn();
    } finally {
      this.activeCount--;
    }
  }
}

const audioLoadQueue = new AudioLoadQueue(3);

// ─────────────────────────────────────────────────────────────────
// CACHE LAYER (revokes blob URLs when expiring / clearing)
// ─────────────────────────────────────────────────────────────────

class CacheManager {
  constructor() {
    this.cache = new Map();
  }

  set(key, value) {
    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > CACHE_TTL) {
      // revoke blob url if stored
      if (typeof item.data === "string" && item.data.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.data);
        } catch {
          // ignore
        }
      }
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  clear() {
    // revoke all blob urls before clearing
    for (const item of this.cache.values()) {
      if (typeof item.data === "string" && item.data.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.data);
        } catch {
          // ignore
        }
      }
    }
    this.cache.clear();
  }

  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        const item = this.cache.get(key);
        if (item && typeof item.data === "string" && item.data.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(item.data);
          } catch {
            // ignore
          }
        }
        this.cache.delete(key);
      }
    }
  }
}

const cacheManager = new CacheManager();

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
  const origWords = String(original || "").split(/(\s+)/);
  const modWords = String(modified || "").split(/(\s+)/);

  if (Math.abs(origWords.length - modWords.length) > 5) {
    return [
      ...origWords.map((w) => ({ type: "removed", text: w })),
      ...modWords.map((w) => ({ type: "added", text: w })),
    ];
  }

  const result = [];
  const maxLen = Math.max(origWords.length, modWords.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origWords[i] || "";
    const mod = modWords[i] || "";

    if (orig === mod) result.push({ type: "same", text: orig });
    else if (!orig) result.push({ type: "added", text: mod });
    else if (!mod) result.push({ type: "removed", text: orig });
    else {
      result.push({ type: "removed", text: orig });
      result.push({ type: "added", text: mod });
    }
  }

  return result;
}

const DiffHighlight = memo(function DiffHighlight({ original, modified }) {
  if (!original || !modified) return <span>{modified || original}</span>;
  if (original === modified) return <span>{original}</span>;

  const diff = useMemo(() => diffWords(original, modified), [original, modified]);

  return (
    <span>
      {diff.map((segment, idx) => {
        if (segment.type === "same") return <span key={idx}>{segment.text}</span>;
        if (segment.type === "added") {
          return (
            <span key={idx} className="dv-diff-added">
              {segment.text}
            </span>
          );
        }
        return (
          <span key={idx} className="dv-diff-removed">
            {segment.text}
          </span>
        );
      })}
    </span>
  );
});

// ─────────────────────────────────────────────────────────────────
// AUDIO PLAYER (Memoized with Loading Queue)
// FIXED: do not revoke cached blob URL on unmount
// ─────────────────────────────────────────────────────────────────

const AudioPlayer = memo(function AudioPlayer({ fileId }) {
  const audioRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const cached = cacheManager.get(`audio_${fileId}`);
    if (cached) {
      setBlobUrl(cached);
      setLoading(false);
      return undefined;
    }

    let didCancel = false;

    const loadAudio = async () => {
      try {
        await audioLoadQueue.load(fileId, async () => {
          const res = await api.get(`/api/audio/${fileId}/stream`, {
            responseType: "blob",
            timeout: 60000,
          });

          if (didCancel) return;

          if (!res.data || res.data.size === 0) {
            setError("Empty audio response");
            return;
          }

          const objectUrl = URL.createObjectURL(res.data);
          setBlobUrl(objectUrl);
          cacheManager.set(`audio_${fileId}`, objectUrl);
        });

        if (!didCancel) setLoading(false);
      } catch {
        if (!didCancel) {
          setError("Audio unavailable");
          setLoading(false);
        }
      }
    };

    loadAudio();

    // IMPORTANT: do not revoke blob URL here; it is cached.
    return () => {
      didCancel = true;
    };
  }, [fileId]);

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !blobUrl) return;
    if (playing) a.pause();
    else a.play();
    setPlaying((p) => !p);
  }, [playing, blobUrl]);

  const seek = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const a = audioRef.current;
    if (a?.duration) {
      a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    }
  }, []);

  const fmtTime = useCallback((s) => {
    if (!s || Number.isNaN(s)) return "0:00";
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }, []);

  if (loading) {
    return (
      <div className="dv-player">
        <span className="dv-time">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dv-player">
        <span className="dv-time dv-time-err">{error}</span>
      </div>
    );
  }

  return (
    <div className="dv-player">
      <audio
        ref={audioRef}
        src={blobUrl || undefined}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a?.duration) setProgress((a.currentTime / a.duration) * 100);
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        preload="metadata"
      />

      <button className="dv-play-btn" onClick={toggle} disabled={!blobUrl}>
        {playing ? "Pause" : "Play"}
      </button>

      <div className="dv-track" onClick={seek}>
        <div className="dv-track-fill" style={{ width: `${progress}%` }} />
      </div>

      <span className="dv-time">
        {fmtTime(audioRef.current?.currentTime)} / {fmtTime(duration)}
      </span>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────
// ADMIN REVIEW CARD (Memoized)
// - Admin can edit final text before Accept
// ─────────────────────────────────────────────────────────────────

const AdminReviewCard = memo(function AdminReviewCard({ file, onVerdict, isVerdicting }) {
  const [note, setNote] = useState("");
  const studentName = file.studentName || file.assignedTo || "Unknown";

  const [editing, setEditing] = useState(false);
  const [finalRaw, setFinalRaw] = useState(file.studentRawText || "");
  const [finalNorm, setFinalNorm] = useState(file.studentNormalizedText || "");

  useEffect(() => {
    setEditing(false);
    setFinalRaw(file.studentRawText || "");
    setFinalNorm(file.studentNormalizedText || "");
    setNote("");
  }, [file._id]);

  const acceptDisabled = isVerdicting || !finalRaw.trim() || !finalNorm.trim();

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
          <button
            type="button"
            className="dv-icon-btn"
            onClick={() => setEditing((v) => !v)}
            disabled={isVerdicting}
          >
            {editing ? "Close" : "Edit"}
          </button>
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
            <div className="dv-review-col-sublabel">Final</div>
            {!editing ? (
              <div className="dv-review-text dv-review-text-student">
                {finalRaw ? (
                  <DiffHighlight original={file.rawText || ""} modified={finalRaw} />
                ) : (
                  <em className="dv-no-text">No text</em>
                )}
              </div>
            ) : (
              <textarea
                className="dv-admin-edit"
                value={finalRaw}
                onChange={(e) => setFinalRaw(e.target.value)}
                rows={4}
              />
            )}
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
            <div className="dv-review-col-sublabel">Final</div>
            {!editing ? (
              <div className="dv-review-text dv-review-text-student">
                {finalNorm ? (
                  <DiffHighlight original={file.normalizedText || ""} modified={finalNorm} />
                ) : (
                  <em className="dv-no-text">No text</em>
                )}
              </div>
            ) : (
              <textarea
                className="dv-admin-edit"
                value={finalNorm}
                onChange={(e) => setFinalNorm(e.target.value)}
                rows={4}
              />
            )}
          </div>
        </div>
      </div>

      <div className="dv-review-footer">
        <input
          className="dv-note-input"
          placeholder="Admin note..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="dv-verdict-btns">
          <button
            className="dv-btn dv-btn-accept"
            disabled={acceptDisabled}
            onClick={() =>
              onVerdict(file._id, "verified", note, {
                finalRawText: finalRaw,
                finalNormalizedText: finalNorm,
              })
            }
          >
            Accept
          </button>

          <button
            className="dv-btn dv-btn-reject"
            disabled={isVerdicting}
            onClick={() => onVerdict(file._id, "rejected", note)}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────
// STUDENT FILE CARD (Memoized)
// ─────────────────────────────────────────────────────────────────

const FileCard = memo(function FileCard({ file, onSubmit, isSubmitting }) {
  const [rawText, setRawText] = useState(file.studentRawText || file.rawText || "");
  const [normalizedText, setNormalizedText] = useState(
    file.studentNormalizedText || file.normalizedText || ""
  );

  const isSubmitted = file.status === "submitted";
  const showCountdown = file.status === "assigned" && file.expiresIn > 0;
  const canSubmit = !isSubmitting && rawText.trim() && normalizedText.trim();

  const handleSubmit = useCallback(() => {
    onSubmit(file._id, { studentRawText: rawText, studentNormalizedText: normalizedText });
  }, [file._id, rawText, normalizedText, onSubmit]);

  return (
    <div className={`dv-card ${isSubmitted ? "dv-card-submitted" : ""}`}>
      <div className="dv-card-head">
        <div className="dv-card-meta">
          <div className="dv-card-title-row">
            <span className="dv-filename">{file.filename}</span>
            <span className="dv-id">#{shortId(file._id)}</span>
          </div>
          <span className="dv-path">
            {file.movieFolder}
            {file.chapterFolder ? ` / ${file.chapterFolder}` : ""}
          </span>
        </div>

        <div className="dv-card-right">
          {showCountdown && (
            <span className={`dv-countdown ${file.expiresIn < 3_600_000 ? "dv-countdown-warn" : ""}`}>
              {fmtCountdown(file.expiresIn)}
            </span>
          )}
          {isSubmitted && <span className="dv-badge-submitted">Submitted</span>}
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
            placeholder="Raw text..."
          />
        </div>

        <div className="dv-field">
          <label>Normalized Text</label>
          <textarea
            value={normalizedText}
            onChange={(e) => setNormalizedText(e.target.value)}
            rows={3}
            disabled={isSubmitted}
            placeholder="Normalized text..."
          />
        </div>
      </div>

      {!isSubmitted && (
        <div className="dv-card-footer">
          <button className="dv-submit-btn" onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────
// AVAILABLE ROW (Memoized)
// ─────────────────────────────────────────────────────────────────

const AvailableRow = memo(function AvailableRow({ file, selected, onToggle }) {
  const handleClick = useCallback(() => onToggle(file._id), [file._id, onToggle]);

  return (
    <div className={`dv-row ${selected ? "dv-row-selected" : ""}`} onClick={handleClick}>
      <div className="dv-row-check">{selected ? "On" : "Off"}</div>
      <div className="dv-row-id">#{shortId(file._id)}</div>
      <div className="dv-row-info">
        <span className="dv-filename">{file.filename}</span>
        <span className="dv-path">
          {file.movieFolder}
          {file.chapterFolder ? ` / ${file.chapterFolder}` : ""}
        </span>
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

  // ── shared ──
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const searchTimer = useRef(null);

  // ─────────────────────────────────────────────────────────────
  // LOADERS
  // ─────────────────────────────────────────────────────────────

  const loadMyFiles = useCallback(async () => {
    try {
      const cached = cacheManager.get("myFiles");
      if (cached) {
        setMyFiles(cached);
        return;
      }

      const res = await api.get("/api/audio/my", { timeout: 10000 });
      const files = res.data.files || [];
      cacheManager.set("myFiles", files);
      setMyFiles(files);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load files");
    }
  }, []);

  const loadAvailable = useCallback(async (q = "") => {
    try {
      const cacheKey = `available_${q}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        setAvailable(cached.items);
        setAvTotal(cached.total);
        return;
      }

      setLoading(true);
      const res = await api.get("/api/audio/available", {
        params: { q: q || undefined, limit: 500 },
        timeout: 15000,
      });

      const data = { items: res.data.items || [], total: res.data.total || 0 };
      cacheManager.set(cacheKey, data);

      setAvailable(data.items);
      setAvTotal(data.total);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load available files");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAdminFiles = useCallback(async (page = 1, status = "submitted", q = "") => {
    try {
      const cacheKey = `admin_${page}_${status}_${q}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) {
        setAdminFiles(cached.items);
        setAdminTotal(cached.total);
        setAdminPage(page);
        return;
      }

      setLoading(true);
      const res = await api.get("/api/audio", {
        params: { page, limit: LIMIT, status, q: q || undefined },
        timeout: 15000,
      });

      const data = { items: res.data.items || [], total: res.data.total || 0 };
      cacheManager.set(cacheKey, data);

      setAdminFiles(data.items);
      setAdminTotal(data.total);
      setAdminPage(page);
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const cached = cacheManager.get("stats");
      if (cached) {
        setStats(cached);
        return;
      }

      const res = await api.get("/api/audio/stats", { timeout: 10000 });
      cacheManager.set("stats", res.data);
      setStats(res.data);
    } catch {
      // ignore
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isAdmin) {
      loadAdminFiles(1, "submitted", "");
      loadStats();
    } else {
      loadMyFiles();
      loadAvailable("");
    }
  }, [isAdmin, loadAdminFiles, loadStats, loadMyFiles, loadAvailable]);

  // ─────────────────────────────────────────────────────────────
  // SEARCH (Debounced)
  // ─────────────────────────────────────────────────────────────

  const handleAvSearch = useCallback(
    (val) => {
      setAvSearch(val);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        cacheManager.invalidate("available_");
        loadAvailable(val);
      }, SEARCH_DEBOUNCE);
    },
    [loadAvailable]
  );

  const handleAdminSearch = useCallback(
    (val) => {
      setAdminSearch(val);
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        cacheManager.invalidate("admin_");
        loadAdminFiles(1, adminStatus, val);
      }, SEARCH_DEBOUNCE);
    },
    [loadAdminFiles, adminStatus]
  );

  const handleStatusChange = useCallback(
    (newStatus) => {
      setAdminStatus(newStatus);
      cacheManager.invalidate("admin_");
      loadAdminFiles(1, newStatus, adminSearch);
    },
    [loadAdminFiles, adminSearch]
  );

  // ─────────────────────────────────────────────────────────────
  // STUDENT ACTIONS
  // ─────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_PER_DAY ? prev : [...prev, id]
    );
  }, []);

  const handleAssign = useCallback(async () => {
    if (!selected.length) return;

    const selectedItems = available.filter((f) => selected.includes(f._id));
    const originalState = { available, myFiles, avTotal };

    setAvailable((prev) => prev.filter((f) => !selected.includes(f._id)));
    setMyFiles((prev) => [
      ...prev,
      ...selectedItems.map((f) => ({
        ...f,
        status: "assigned",
        assignedAt: new Date(),
        expiresIn: EXPIRE_MS,
      })),
    ]);
    setAvTotal((prev) => Math.max(0, prev - selected.length));
    setSelected([]);
    setAssigning(true);
    setError("");
    setTab("inprogress");

    try {
      await api.post("/api/audio/assign", { fileIds: selected }, { timeout: 20000 });
      setSuccess(`Assigned ${selected.length} file(s).`);
      cacheManager.invalidate("myFiles");
      cacheManager.invalidate("available_");
    } catch (e) {
      setAvailable(originalState.available);
      setMyFiles(originalState.myFiles);
      setAvTotal(originalState.avTotal);
      setError(e?.response?.data?.message || "Assignment failed");
      setTab("available");
    } finally {
      setAssigning(false);
    }
  }, [selected, available, myFiles, avTotal]);

  const handleSubmit = useCallback(
    async (fileId, payload) => {
      const originalFiles = myFiles;

      setMyFiles((prev) =>
        prev.map((f) =>
          f._id === fileId
            ? {
                ...f,
                status: "submitted",
                ...payload,
                submittedAt: new Date(),
              }
            : f
        )
      );

      setSubmitting(fileId);
      setError("");

      try {
        await api.post(`/api/audio/${fileId}/submit`, payload, { timeout: 15000 });
        setSuccess("Submitted");
        cacheManager.invalidate("myFiles");
      } catch (e) {
        setMyFiles(originalFiles);
        setError(e?.response?.data?.message || "Submission failed");
      } finally {
        setSubmitting(null);
      }
    },
    [myFiles]
  );

  // ─────────────────────────────────────────────────────────────
  // ADMIN ACTIONS
  // ─────────────────────────────────────────────────────────────

  const handleVerdict = useCallback(
    async (fileId, verdict, adminNote = "", extra = null) => {
      const originalFiles = adminFiles;

      setAdminFiles((prev) => prev.filter((f) => f._id !== fileId));
      setVerdicting(fileId);
      setError("");

      try {
        await api.patch(
          `/api/audio/${fileId}/verify`,
          extra ? { verdict, adminNote, ...extra } : { verdict, adminNote },
          { timeout: 20000 }
        );

        setSuccess(verdict === "verified" ? "Verified" : "Rejected");
        cacheManager.invalidate("admin_");
        cacheManager.invalidate("stats");

        await loadStats();
      } catch (e) {
        setAdminFiles(originalFiles);
        setError(e?.response?.data?.message || "Verdict failed");
      } finally {
        setVerdicting(null);
      }
    },
    [adminFiles, loadStats]
  );

  const handleExport = useCallback(async (format) => {
    try {
      const res = await api.get(`/api/audio/export?format=${format}`, {
        responseType: "blob",
        timeout: 30000,
      });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tts_dataset.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // MEMO
  // ─────────────────────────────────────────────────────────────

  const adminTotalPages = useMemo(() => Math.max(1, Math.ceil(adminTotal / LIMIT)), [adminTotal]);
  const inProgressFiles = useMemo(() => myFiles.filter((f) => f.status === "assigned"), [myFiles]);
  const submittedFiles = useMemo(() => myFiles.filter((f) => f.status === "submitted"), [myFiles]);

  if (!user) return <div className="dv-loading">Loading...</div>;

  return (
    <div className="dv">
      {error && (
        <div className="dv-alert dv-alert-error" onClick={() => setError("")}>
          {error} <span className="dv-alert-close">x</span>
        </div>
      )}

      {success && (
        <div className="dv-alert dv-alert-success" onClick={() => setSuccess("")}>
          {success} <span className="dv-alert-close">x</span>
        </div>
      )}

      {/* ADMIN VIEW */}
      {isAdmin && (
        <div>
          <div className="dv-page-header">
            <div>
              <h2 className="dv-title">Data Validation</h2>
              <p className="dv-sub">Listen, compare, accept or reject</p>
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
              placeholder="Search..."
              value={adminSearch}
              onChange={(e) => handleAdminSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="dv-loading">Loading...</div>
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
                    <th>Raw</th>
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
                      <td>
                        <AudioPlayer fileId={f._id} />
                      </td>
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

            <button className="dv-btn" onClick={() => handleExport("json")}>
              JSON
            </button>
            <button className="dv-btn" onClick={() => handleExport("csv")}>
              CSV
            </button>
          </div>
        </div>
      )}

      {/* STUDENT VIEW */}
      {!isAdmin && (
        <div>
          <div className="dv-page-header">
            <div>
              <h2 className="dv-title">Data Validation</h2>
              <p className="dv-sub">Listen, correct, submit</p>
            </div>
          </div>

          <div className="dv-tabs">
            <button
              className={`dv-tab ${tab === "inprogress" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("inprogress")}
            >
              In Progress
              {inProgressFiles.length > 0 && <span className="dv-tab-count">{inProgressFiles.length}</span>}
            </button>

            <button
              className={`dv-tab ${tab === "submitted" ? "dv-tab-active" : ""}`}
              onClick={() => setTab("submitted")}
            >
              Submitted
              {submittedFiles.length > 0 && <span className="dv-tab-count">{submittedFiles.length}</span>}
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
                    <FileCard key={f._id} file={f} onSubmit={handleSubmit} isSubmitting={submitting === f._id} />
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
                        <span className="dv-badge-submitted">Submitted</span>
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
                  placeholder="Search..."
                  value={avSearch}
                  onChange={(e) => handleAvSearch(e.target.value)}
                />

                {selected.length > 0 && (
                  <button className="dv-btn dv-btn-assign" onClick={handleAssign} disabled={assigning}>
                    {assigning ? "Assigning..." : `Assign ${selected.length}`}
                  </button>
                )}
              </div>

              {selected.length > 0 && (
                <div className="dv-assign-bar">
                  <span>
                    {selected.length}/{MAX_PER_DAY} selected
                  </span>
                  <button className="dv-btn" onClick={() => setSelected([])}>
                    Clear
                  </button>
                </div>
              )}

              {loading ? (
                <div className="dv-loading">Loading...</div>
              ) : available.length === 0 ? (
                <div className="dv-empty">No available files.</div>
              ) : (
                <div className="dv-available-list">
                  {available.map((f) => (
                    <AvailableRow key={f._id} file={f} selected={selected.includes(f._id)} onToggle={toggleSelect} />
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
