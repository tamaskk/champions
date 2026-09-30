/**
 * Who runs Spinvincible – used by /privacy, /terms and /support. Fill in every [BRACKETED] value
 * before publishing (and have the texts reviewed by a lawyer: they are a template, not legal advice).
 */
export const OPERATOR = {
  /** Legal name of the company or sole trader running the app. */
  name: "[Operator legal name]",
  /** Registered address. */
  address: "[Street, City, Postcode, Country]",
  /** Company registration / tax number, if any. */
  registration: "[Company registration no. / tax no.]",
  /** Where players write for support, privacy and deletion requests. */
  email: "[support@your-domain.com]",
  /** Country whose law governs the Terms (and whose courts decide). */
  country: "Hungary",
  /** Supervisory authority for data protection complaints. */
  authority: "Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH), https://naih.hu",
  /** Region where the database is hosted (MongoDB Atlas). */
  databaseRegion: "[e.g. EU – Frankfurt]",
  /** Minimum age to use the app. */
  minimumAge: 16,
} as const;

/** Date the legal texts were last changed (shown on the pages). */
export const LEGAL_UPDATED = "2026-09-30";
