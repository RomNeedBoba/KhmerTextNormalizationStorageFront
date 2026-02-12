/**
 * SAFE Khmer Unicode normalization (frontend-only)
 *
 * What we do (safe):
 * - NFC normalization
 * - Remove known unwanted zero-width/invisible chars
 * - Normalize whitespace (without harming emojis/latin)
 *
 * What we do NOT do (unsafe):
 * - Generic Khmer combining mark sorting/reordering (can break correct text)
 *
 * Optional targeted fix:
 * - Fix a common mis-encoding pattern where a pre-vowel sign (េ/ែ/ៃ/ោ/ៅ)
 *   appears before a COENG+CONSONANT sequence inside the same Khmer syllable.
 *
 * This stays conservative to avoid changing correct Khmer into incorrect Khmer.
 */

const ZERO_WIDTH_REMOVE_RE = /[\u200B\u200E\u200F\u2060\uFEFF]/g; // ZWSP, LRM, RLM, WJ, BOM
const COENG = "\u17D2";

// Khmer pre-vowel signs that are often misplaced in copied text
const PRE_VOWELS = new Set([
  "\u17C1", // េ
  "\u17C2", // ែ
  "\u17C3", // ៃ
  "\u17C4", // ោ
  "\u17C5", // ៅ
]);

function isKhmerConsonant(ch) {
  // Khmer consonants range (basic). This is a conservative check.
  return /[\u1780-\u17A2]/.test(ch);
}

function normalizeWhitespaceAndNfc(input) {
  const original = String(input ?? "");

  // NFC first
  let text = original.normalize("NFC");

  // remove unwanted zero-width chars
  text = text.replace(ZERO_WIDTH_REMOVE_RE, "");

  // normalize whitespace (preserve newlines, keep emojis, don't strip punctuation)
  text = text
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, changed: text !== original };
}

/**
 * Targeted fix:
 * Base + PRE_VOWEL + COENG + Consonant  => Base + COENG + Consonant + PRE_VOWEL
 *
 * Example:
 *  "ខែ្មរ" (ខ + ែ + ្ + ម + រ)  => "ខ្មែរ" (ខ + ្ + ម + ែ + រ)
 *
 * This is intentionally narrow and will not try to reorder anything else.
 */
function fixPreVowelBeforeCoeng(text) {
  const chars = [...text]; // codepoint-safe
  let corrected = false;

  for (let i = 0; i < chars.length - 3; i++) {
    const a = chars[i];
    const b = chars[i + 1];
    const c = chars[i + 2];
    const d = chars[i + 3];

    if (!isKhmerConsonant(a)) continue;
    if (!PRE_VOWELS.has(b)) continue;
    if (c !== COENG) continue;
    if (!isKhmerConsonant(d)) continue;

    // rewrite a b c d -> a c d b
    chars.splice(i, 4, a, c, d, b);
    corrected = true;

    // continue scanning (do not jump too far)
  }

  return { text: chars.join(""), corrected };
}

/**
 * Main API:
 * returns { text, corrected }
 */
export function normalizeKhmerEncoding(input) {
  // Step 1-3: safe cleanup
  const r0 = normalizeWhitespaceAndNfc(input);
  let text = r0.text;
  let corrected = r0.changed;

  // Step 4: targeted Khmer fix (optional but useful)
  const r1 = fixPreVowelBeforeCoeng(text);
  if (r1.corrected) corrected = true;
  text = r1.text;

  return { text, corrected };
}