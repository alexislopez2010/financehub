# Supabase migrations

Numeric-prefixed SQL files in this directory are applied **in lexical order**.
The existing `supabase/schema.sql` is the canonical fresh-install schema; it
is updated to reflect the rolled-up state after every migration here.

## How to apply

**Staging (preview branch):**

    source ~/.config/financehub/staging.env
    psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_household_members_policies.sql

**Production:** apply via the Supabase SQL Editor (paste, Run). Always
apply to staging first, smoke-test, then prod. Never edit a migration
file after it has run in production — write a new file instead.

## File naming

    NNNN_short_description.sql

Where NNNN is a four-digit zero-padded ordinal. Files are NOT timestamped
so the order is unambiguous and renames stay impossible.
