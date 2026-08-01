// Pure text-normalization helpers, safe to import from BOTH client and server
// (no server-only dependencies). Centralizes the fixes discovered while
// debugging the iPad login issue so every credential / phone / numeric input
// across the app can be cleaned the same way.

// Strip invisible Unicode formatting characters that iOS/Safari silently
// injects into inputs on an RTL (Arabic) page — most notably the Right-to-Left
// Mark (U+200F). They are invisible, so the user "types 1383" but the field
// actually holds U+200F + "1383", which never matches the stored value.
// Covers zero-width chars (U+200B–U+200D), LRM/RLM (U+200E/200F), the Arabic
// Letter Mark (U+061C), bidi embeddings/overrides (U+202A–U+202E), bidi
// isolates (U+2066–U+2069) and the BOM (U+FEFF).
const INVISIBLE_RE = /[​-‏؜‪-‮⁦-⁩﻿]/g;
export function stripInvisible(s: string): string {
  return (s ?? "").replace(INVISIBLE_RE, "");
}

// Convert Arabic-Indic (٠-٩) and Persian (۰-۹) digits to ASCII 0-9. Arabic
// keyboards commonly enter numbers as Arabic-Indic, which never matches the
// ASCII values stored in the DB.
export function normalizeDigits(s: string): string {
  return (s ?? "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0));
}

// Full normalization for credentials / identifiers: drop invisible characters,
// fold Arabic digits to ASCII, then trim surrounding whitespace.
export function normalizeCredential(s: string): string {
  return normalizeDigits(stripInvisible(s ?? "")).trim();
}

// Normalize a phone entry: fold Arabic digits, strip invisibles, then keep
// digits only (matches the app's stored phone format). Handles the case where a
// phone typed on an Arabic keyboard would otherwise be wiped by a naive
// /\D/g strip (Arabic-Indic digits are not ASCII \d).
export function normalizePhone(s: string): string {
  return normalizeDigits(stripInvisible(s ?? "")).replace(/\D/g, "");
}
