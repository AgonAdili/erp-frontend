/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
/** UI language (CORE 04: MK default, SQ and EN; FE/09 catalogue). MK is the source: the key IS the Macedonian text, and
 * en.json / sq.json come from FE/_build/i18n/catalog.txt (do not edit them by hand; add a line to the catalogue).
 * A string missing from the catalogue shows its Macedonian text, never an empty label. Field and resource labels come
 * translated from the server (Django i18n, POST /auth/language/). "EA Group" and "EACore" are names, never translated.
 * SQ is a draft until a native reviewer signs it off.
 *
 * The catalogue loads before the app's modules run (main.tsx), so module-level labels are translated too. Changing the
 * language saves it on the server, then reloads the page. */
export type Lang = "mk" | "en" | "sq";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "mk", label: "Македонски" }, { code: "sq", label: "Shqip" }, { code: "en", label: "English" },
];

const KEY = "eacore.lang";
let current: Lang = "mk";
let catalog: Record<string, string> = {};

export function isLang(v: unknown): v is Lang {
  return v === "mk" || v === "en" || v === "sq";
}

/** The language this page was loaded in. */
export function lang(): Lang {
  return current;
}

export function storedLang(): Lang {
  try {
    const v = window.localStorage.getItem(KEY);
    return isLang(v) ? v : "mk";
  } catch {
    return "mk";
  }
}

export function storeLang(code: Lang) {
  try { window.localStorage.setItem(KEY, code); } catch { /* storage unavailable */ }
}

/** Load the catalogue for the stored language (only EN and SQ have one). */
export async function loadLanguage(code: Lang = storedLang()): Promise<void> {
  current = code;
  catalog = code === "en" ? (await import("./en.json")).default : code === "sq" ? (await import("./sq.json")).default : {};
  document.documentElement.lang = code;
}

/** Translate Macedonian UI text; {0}, {1} … are filled in order. */
export function tr(mk: string, ...args: (string | number | null | undefined)[]): string {
  let s = catalog[mk] ?? mk;
  args.forEach((a, i) => { s = s.split(`{${i}}`).join(String(a ?? "")); });
  return s;
}
