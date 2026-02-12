import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { normalizeKhmerEncoding } from "../utils/khmerUnicodeNormalizer";

/**
 * Minimal CSV line parser with quotes support.
 * Returns array of string columns for a single line.
 */
function parseCsvLine(line) {
  const cols = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      cols.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  cols.push(cur);
  return cols;
}

/**
 * Parse CSV text into rows (objects) using required headers:
 * raw_text,type,normtext,span_raw,span_type,span_norm
 *
 * - Supports quoted fields
 * - Skips empty lines
 */
function parseParallelCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) return { header: [], rows: [] };

  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name) => header.indexOf(name);

  const required = ["raw_text", "type", "normtext", "span_raw", "span_type", "span_norm"];
  const missing = required.filter((h) => idx(h) === -1);

  if (missing.length > 0) {
    const err = new Error(`CSV header missing: ${missing.join(", ")}`);
    err.code = "BAD_HEADER";
    throw err;
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);

    const row = {
      raw_text: cols[idx("raw_text")] ?? "",
      type: cols[idx("type")] ?? "",
      normtext: cols[idx("normtext")] ?? "",
      span_raw: cols[idx("span_raw")] ?? "",
      span_type: cols[idx("span_type")] ?? "",
      span_norm: cols[idx("span_norm")] ?? "",
    };

    rows.push(row);
  }

  return { header, rows };
}

function splitTypesPipe(s) {
  return String(s || "")
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert normalized rows back to CSV string using the required columns order.
 */
function toParallelCsv(rows) {
  const header = "raw_text,type,normtext,span_raw,span_type,span_norm\n";
  const body = rows
    .map((r) => {
      return [
        csvEscape(r.raw_text),
        csvEscape(r.type),
        csvEscape(r.normtext),
        csvEscape(r.span_raw),
        csvEscape(r.span_type),
        csvEscape(r.span_norm),
      ].join(",");
    })
    .join("\n");
  return header + body + "\n";
}

export default function BulkUploadModal({ open, onClose, onUploaded }) {
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const [previewCount, setPreviewCount] = useState(null);
  const [validCount, setValidCount] = useState(null);
  const [correctedCount, setCorrectedCount] = useState(0);

  const [normalizedRows, setNormalizedRows] = useState([]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setUploading(false);
    setError("");
    setResult(null);
    setPreviewCount(null);
    setValidCount(null);
    setCorrectedCount(0);
    setNormalizedRows([]);
  }, [open]);

  const validateRow = (row) => {
    const raw = row.raw_text.trim();
    const norm = row.normtext.trim();
    const types = splitTypesPipe(row.type);

    if (!raw || !norm) return { ok: false, reason: "Missing raw_text or normtext" };
    if (types.length === 0) return { ok: false, reason: "Missing type" };

    const spanRaw = row.span_raw.trim();
    const spanNorm = row.span_norm.trim();
    const spanTypes = splitTypesPipe(row.span_type);

    // span optional, but if span_raw exists then require span_type + span_norm
    if (spanRaw) {
      if (!spanNorm) return { ok: false, reason: "span_norm required when span_raw provided" };
      if (spanTypes.length === 0)
        return { ok: false, reason: "span_type required when span_raw provided" };
    }

    return { ok: true };
  };

  const onPickFile = async (f) => {
    setFile(f || null);
    setError("");
    setResult(null);
    setPreviewCount(null);
    setValidCount(null);
    setCorrectedCount(0);
    setNormalizedRows([]);

    if (!f) return;

    try {
      const text = await f.text();
      const parsed = parseParallelCsv(text);

      setPreviewCount(parsed.rows.length);

      let corrected = 0;
      const out = [];
      let valid = 0;

      for (const r of parsed.rows) {
        // Khmer encoding normalization on all relevant text fields
        const a = normalizeKhmerEncoding(r.raw_text);
        const b = normalizeKhmerEncoding(r.normtext);
        const c = normalizeKhmerEncoding(r.span_raw);
        const d = normalizeKhmerEncoding(r.span_norm);

        if (a.corrected || b.corrected || c.corrected || d.corrected) corrected++;

        const normalizedRow = {
          raw_text: a.text,
          // Keep pipe-string for backend CSV parsing (backend will split to array)
          type: splitTypesPipe(r.type).join("|"),
          normtext: b.text,
          span_raw: c.text,
          span_type: splitTypesPipe(r.span_type).join("|"),
          span_norm: d.text,
        };

        const v = validateRow(normalizedRow);
        if (!v.ok) continue;

        valid++;
        out.push(normalizedRow);
      }

      setCorrectedCount(corrected);
      setValidCount(valid);
      setNormalizedRows(out);

      if (valid === 0) {
        setError("No valid rows found. Check required columns and values.");
      }
    } catch (e) {
      setError(e?.message || "Failed to read/parse CSV.");
    }
  };

  const upload = async () => {
    setError("");
    setResult(null);

    if (!file) {
      setError("Please choose a CSV file.");
      return;
    }

    if (!normalizedRows.length) {
      setError("No valid rows to upload.");
      return;
    }

    // Build normalized CSV file
    const csvText = toParallelCsv(normalizedRows);
    const normalizedFile = new File(
      [csvText],
      file.name.replace(/\.csv$/i, "") + "_normalized.csv",
      { type: "text/csv" }
    );

    const fd = new FormData();
    fd.append("file", normalizedFile);

    setUploading(true);
    try {
      const res = await api.post("/api/textnorm/bulk", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      onUploaded();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} title="Bulk Add (Parallel CSV Upload)" width="min(840px, 100%)">
      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="alert alert-success" style={{ marginTop: 10 }}>
          Inserted: {result.insertedCount} rows
        </div>
      )}

      <div className="formGrid" style={{ marginTop: 10 }}>
        <div className="field">
          <label>CSV File</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onPickFile(e.target.files?.[0] || null)}
          />

          <div className="smallMuted" style={{ marginTop: 8 }}>
            Format:{" "}
            <code>raw_text,type,normtext,span_raw,span_type,span_norm</code>
            <br />
            Types use <code>|</code> separator (e.g. <code>DATE|TIME</code>)
          </div>

          {previewCount != null && (
            <div className="smallMuted" style={{ marginTop: 10 }}>
              Rows in file: <strong>{previewCount}</strong>
              {validCount != null && (
                <>
                  {" "}
                  — Valid rows: <strong>{validCount}</strong>
                </>
              )}
              {correctedCount > 0 && (
                <>
                  {" "}
                  — <span className="warnTextInline">⚠ {correctedCount} row(s) corrected automatically.</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modalFooter">
          <button className="btn" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={upload} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </Modal>
  );
}