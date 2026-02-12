import { containsKhmer, normalizeKhmerEncoding } from "../utils/khmerUnicodeNormalizer";

export default function KhmerEncodingPreview({ value }) {
  const text = String(value ?? "");

  // Don’t show preview for empty or non-Khmer strings (keeps UI clean)
  if (!text.trim() || !containsKhmer(text)) return null;

  const r = normalizeKhmerEncoding(text);

  // Show preview only when something was corrected
  if (!r.corrected) return null;

  return (
    <div className="khPreview">
      <div className="khPreviewTitle">Auto-correction preview (will be saved like this):</div>
      <div className="khPreviewText">
        {r.segments.map((seg, idx) =>
          seg.corrected ? (
            <span key={idx} className="kBad">
              {seg.text}
            </span>
          ) : (
            <span key={idx}>{seg.text}</span>
          )
        )}
      </div>
      <div className="khPreviewHint">⚠ Khmer character order was corrected automatically.</div>
    </div>
  );
}
