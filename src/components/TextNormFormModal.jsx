import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import Modal from "./Modal";
import TypePills from "./TypePills";
import { normalizeKhmerEncoding } from "../utils/khmerUnicodeNormalizer";

export default function TextNormFormModal({ open, onClose, initial, onSaved }) {
  const isEdit = useMemo(() => Boolean(initial?._id), [initial]);

  const [rawText, setRawText] = useState("");
  const [normalizedText, setNormalizedText] = useState("");
  const [types, setTypes] = useState([]);

  const [spanRawText, setSpanRawText] = useState("");
  const [spanNormalizedText, setSpanNormalizedText] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [rawWarn, setRawWarn] = useState(false);
  const [normWarn, setNormWarn] = useState(false);
  const [spanRawWarn, setSpanRawWarn] = useState(false);
  const [spanNormWarn, setSpanNormWarn] = useState(false);

  useEffect(() => {
    if (!open) return;

    setError("");
    setSaving(false);

    setRawWarn(false);
    setNormWarn(false);
    setSpanRawWarn(false);
    setSpanNormWarn(false);

    setRawText(initial?.rawText || "");
    setNormalizedText(initial?.normalizedText || "");
    setTypes(initial?.types || (initial?.type ? [initial.type] : []));

    setSpanRawText(initial?.spanRawText || "");
    setSpanNormalizedText(initial?.spanNormalizedText || "");
  }, [open, initial]);

  const validate = (p) => {
    if (!p.rawText.trim()) return "Raw Text is required.";
    if (!p.normalizedText.trim()) return "Normalized Text is required.";
    if (!Array.isArray(p.types) || p.types.length === 0) return "Select at least one Type.";

    // span optional: if spanRawText provided => require spanNormalizedText (spanTypes auto = types)
    if (p.spanRawText.trim()) {
      if (!p.spanNormalizedText.trim()) return "Span Normalized Text is required when Span Raw Text is provided.";
    }
    return "";
  };

  const normalizeField = (value, setValue, setWarn) => {
    const r = normalizeKhmerEncoding(value);
    if (r.corrected) setWarn(true);
    setValue(r.text);
  };

  const submit = async () => {
    setError("");

    const r1 = normalizeKhmerEncoding(rawText);
    const r2 = normalizeKhmerEncoding(normalizedText);
    const r3 = normalizeKhmerEncoding(spanRawText);
    const r4 = normalizeKhmerEncoding(spanNormalizedText);

    if (r1.corrected) setRawWarn(true);
    if (r2.corrected) setNormWarn(true);
    if (r3.corrected) setSpanRawWarn(true);
    if (r4.corrected) setSpanNormWarn(true);

    const sr = r3.text.trim();

    const payload = {
      rawText: r1.text,
      normalizedText: r2.text,
      types,

      // Span fields
      spanRawText: sr ? r3.text : "",
      spanNormalizedText: sr ? r4.text : "",

      // ✅ IMPORTANT: backend requires spanTypes if spanRawText exists
      // and per your requirement, spanTypes = types
      spanTypes: sr ? types : [],
    };

    // reflect normalized values
    setRawText(payload.rawText);
    setNormalizedText(payload.normalizedText);
    setSpanRawText(payload.spanRawText);
    setSpanNormalizedText(payload.spanNormalizedText);

    const msg = validate(payload);
    if (msg) {
      setError(msg);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) await api.put(`/api/textnorm/${initial._id}`, payload);
      else await api.post("/api/textnorm", payload);

      onSaved();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Modal open={open} title={isEdit ? "Edit Record" : "Add Record"}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="formGrid" style={{ marginTop: 10 }}>
        <div className="sectionTitle">Sentence Level</div>

        <div className="field">
          <label>Types</label>
          <TypePills value={types} onChange={setTypes} ariaLabel="Select types" />
          <div className="smallMuted" style={{ marginTop: 6 }}>
            These types will also be used for Span Types (if Span is provided).
          </div>
        </div>

        <div className="field">
          <label>Raw Text</label>
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => {
              setRawWarn(false);
              setRawText(e.target.value);
            }}
            onBlur={() => normalizeField(rawText, setRawText, setRawWarn)}
          />
          {rawWarn && <div className="warnText">⚠ Khmer character order was corrected automatically.</div>}
        </div>

        <div className="field">
          <label>Normalized Text</label>
          <textarea
            rows={4}
            value={normalizedText}
            onChange={(e) => {
              setNormWarn(false);
              setNormalizedText(e.target.value);
            }}
            onBlur={() => normalizeField(normalizedText, setNormalizedText, setNormWarn)}
          />
          {normWarn && <div className="warnText">⚠ Khmer character order was corrected automatically.</div>}
        </div>

        <div className="sectionTitle" style={{ marginTop: 6 }}>
          Atomic Span (Optional)
        </div>

        <div className="field">
          <label>Span Raw Text</label>
          <textarea
            rows={2}
            value={spanRawText}
            onChange={(e) => {
              setSpanRawWarn(false);
              setSpanRawText(e.target.value);
            }}
            onBlur={() => normalizeField(spanRawText, setSpanRawText, setSpanRawWarn)}
          />
          {spanRawWarn && <div className="warnText">⚠ Khmer character order was corrected automatically.</div>}
        </div>

        <div className="field">
          <label>Span Normalized Text</label>
          <textarea
            rows={2}
            value={spanNormalizedText}
            onChange={(e) => {
              setSpanNormWarn(false);
              setSpanNormalizedText(e.target.value);
            }}
            onBlur={() => normalizeField(spanNormalizedText, setSpanNormalizedText, setSpanNormWarn)}
          />
          {spanNormWarn && <div className="warnText">⚠ Khmer character order was corrected automatically.</div>}
        </div>

        <div className="modalFooter">
          <button className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}