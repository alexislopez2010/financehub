/**
 * The single Lopez household id used throughout the app. Matches the seed
 * row in supabase/schema.sql and the constant used by the legacy app.
 *
 * The new app is currently single-household. If/when this expands to
 * support multiple households, replace the import with a session-scoped
 * value from a useHousehold() hook.
 */
export const LOPEZ_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001'
