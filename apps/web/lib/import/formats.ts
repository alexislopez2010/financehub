/**
 * Canonical labels for the import-format restriction stored on
 * accounts.import_format. The list is intentionally small and stable —
 * EditAccountDialog renders these as <option> values; UploadStep
 * compares the detected adapter against the account's setting.
 *
 * Identifiers match the existing Adapter `name` field where possible
 * (so an in-flight CSV detected by `chase` matches `'Chase'`); QFX
 * gets its own sentinel because that path bypasses the adapter
 * pattern.
 */

export const IMPORT_FORMATS = [
  'Chase',
  'Capital One',
  'Citibank',
  'Discover',
  'Amex',
  'Generic',
  'QFX/OFX'
] as const

export type ImportFormat = typeof IMPORT_FORMATS[number]

/** Sentinel emitted by the OFX/QFX parser path so it can match against accounts.import_format. */
export const QFX_FORMAT: ImportFormat = 'QFX/OFX'
