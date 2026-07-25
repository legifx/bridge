#!/usr/bin/env bash
# Push the two production secrets to the Vercel project.
#
#   AUTH_SECRET        signs the session cookie. Without it the cookie is a bare
#                      learner id, and the account password only holds as long as
#                      nobody learns an id (see lib/auth/session.ts).
#   OWNER_UNLOCK_CODE  the code that lifts the demo AI budget for your own
#                      account. Reused from the local .env so the code you
#                      already know works on the hosted demo too.
#
# Neither value is ever printed: AUTH_SECRET is generated here and piped
# straight into the CLI, OWNER_UNLOCK_CODE is read from .env the same way.
#
# Run once, after `vercel login`:
#   bash scripts/setup-vercel-env.sh
#
# Setting AUTH_SECRET signs out existing hosted sessions once — by design: an
# unsigned cookie must stop being accepted the moment signing is switched on.
set -euo pipefail
cd "$(dirname "$0")/.."

SCOPE="legifx"
PROJECT="bridge"

# Two ways in, because `vercel login` needs a browser this machine may not have:
#   1. an interactive `vercel login` (writes the CLI's own auth file), or
#   2. a token from vercel.com/account/tokens saved to ~/.vercel-token —
#      kept in a file on purpose, so the secret never travels through a chat
#      or a shell history.
TOKEN_FILE="$HOME/.vercel-token"
VERCEL_ARGS=(--scope "$SCOPE")
if [ -z "${VERCEL_TOKEN:-}" ] && [ -r "$TOKEN_FILE" ]; then
  VERCEL_TOKEN="$(tr -d " \t\n\r" < "$TOKEN_FILE")"
fi
if [ -n "${VERCEL_TOKEN:-}" ]; then
  VERCEL_ARGS+=(--token "$VERCEL_TOKEN")
  echo "Using the token from ${TOKEN_FILE/#$HOME/~}."
fi

# Not "vercel whoami || exit": without a token the CLI waits for an interactive
# login instead of failing, so an unattended run would hang forever.
if ! timeout 25 npx vercel whoami "${VERCEL_ARGS[@]}" >/dev/null 2>&1; then
  echo "Not authenticated (or the CLI is waiting for input). Either:" >&2
  echo "  npx vercel login                                    # browser" >&2
  echo "  echo '<token>' > ~/.vercel-token && chmod 600 ~/.vercel-token" >&2
  exit 1
fi

[ -d .vercel ] || npx vercel link --yes "${VERCEL_ARGS[@]}" --project "$PROJECT" >/dev/null

set_env() { # name, value on stdin
  local name="$1"
  # Remove first so a re-run updates rather than failing on a duplicate.
  npx vercel env rm "$name" production --yes "${VERCEL_ARGS[@]}" >/dev/null 2>&1 || true
  npx vercel env add "$name" production "${VERCEL_ARGS[@]}" >/dev/null
  echo "  set $name (production)"
}

echo "Setting production environment variables for $PROJECT:"

node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | set_env AUTH_SECRET

if [ -f .env ] && grep -q '^OWNER_UNLOCK_CODE=.\+' .env; then
  grep '^OWNER_UNLOCK_CODE=' .env | head -1 | cut -d= -f2- | tr -d '"' | set_env OWNER_UNLOCK_CODE
else
  echo "  skipped OWNER_UNLOCK_CODE — not set in local .env"
fi

echo
echo "Done. Redeploy for them to take effect:  npx vercel --prod --scope $SCOPE"
echo "Verify afterwards: the session cookie should read <id>.<signature>, not a bare id."
