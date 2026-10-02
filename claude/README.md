# Claude Code status line

> **Personal setup, use at your own risk.** This is my own configuration, shared
> as-is with no warranty and no support. Read the scripts before running them —
> `install.sh` writes into `~/.claude/` and modifies your `settings.json`.

Renders a single status line in Claude Code:

```
Opus 5 (1M context) · high · ███░░░░░░░ 312k/1M · $2.40/~$48.10 · 12m/1h05m · my-branch*
```

| Segment | Source | Notes |
| --- | --- | --- |
| Model name | `model.display_name` | |
| Effort level | `effort.level` | omitted if absent |
| Context bar | `context_window` | tokens used / window capacity; bar turns yellow at 60%, red at 85% |
| Cost | `cost.total_cost_usd` / account total | session cost / account-wide spend |
| Time | `cost.total_api_duration_ms` / `total_duration_ms` | API compute time / wall-clock |
| Git branch | `git status -sb` | `*` suffix when the tree is dirty |

Three segments read as `current / total` (tokens, cost, time), with the second
value in a darker shade of the same hue.

## Install

```bash
bash install.sh
```

This copies both scripts into `~/.claude/` and merges the `statusLine` block into
`~/.claude/settings.json` (backing up the previous file to `settings.json.bak`).

Requires `node` on PATH. Nothing else.

## Uninstall

```bash
bash uninstall.sh
```

Deletes the `statusLine` key from `~/.claude/settings.json` (leaving all other
settings untouched) and removes the two scripts plus the cache and lock files.
Claude Code reverts to its built-in status line on the next render.

Note that both scripts rewrite `settings.json` via a JSON round-trip, so the file
is re-emitted with 2-space indentation — the same formatting Claude Code itself
writes. The `.bak` file is a byte-exact copy taken before any change.

## Files

- `statusline.js` — the renderer. Reads the status line JSON from stdin, prints one line. Runs entirely locally, ~160ms, no API calls.
- `statusline-usage-fetch.js` — fetches the account-wide spend figure and caches it. Spawned **detached** by `statusline.js`, so the prompt never blocks on network I/O.
- `settings-statusline-snippet.json` — the `statusLine` block to merge into `~/.claude/settings.json`.
- `merge-settings.mjs` — adds that block, or removes it with `--remove`, without disturbing other settings.
- `install.sh` / `uninstall.sh` — the two entry points.

## How the account total works

`statusline.js` only ever reads a cache file. When that cache is older than 30
minutes it spawns `statusline-usage-fetch.js` in the background (guarded by a
lock file so concurrent renders don't pile up duplicate fetches). The fetcher
calls `https://api.anthropic.com/api/oauth/usage` using the local OAuth token and
writes `spend.used.amount_minor / 10^exponent` to the cache.

The figure is prefixed with `~` once the cache is more than 2 minutes old — a
deliberately short window, because the total won't include the current session's
in-flight cost or spend from other open sessions. The actual re-fetch still only
happens every 30 minutes.

Machine-local files, not tracked: `~/.claude/.statusline-usage-cache.json` and its `.lock`.

## Disclaimer

The account-spend segment depends on `https://api.anthropic.com/api/oauth/usage`,
which is an **internal, undocumented endpoint** used by Claude Code itself. It is
not part of the public Claude API, it is not documented, and Anthropic has made no
commitment to keeping it stable — a request to expose this data officially was
[closed as "not planned"](https://github.com/anthropics/claude-code/issues/34348).

What that means in practice:

- **It can change or disappear at any time**, without warning or a deprecation
  notice. The script degrades gracefully when that happens (the segment simply
  vanishes; the rest of the line keeps working), but do not build anything on it.
- **The shape of the response is not guaranteed.** The fields this script reads
  (`spend.used.amount_minor`, `extra_usage.used_credits`) were found by inspecting
  a live response, not from documentation. They are populated for some account
  types and not others.
- **Treat the number as indicative, not authoritative.** The figure of record is
  always the one shown at <https://claude.ai/settings/usage>. This is a
  convenience readout, not a billing source.
- **Only you can judge whether calling it is appropriate** for your account or
  your organization's policies. If in doubt, don't — delete the fetcher and the
  account segment omits itself automatically.

Everything else in this status line (model, context usage, session cost, session
time, git branch) comes from the **documented** status line JSON payload that
Claude Code pipes to the command, and does not touch any network API.

## What this sends where

`statusline-usage-fetch.js` reads your Claude Code OAuth token — from
`CLAUDE_CODE_OAUTH_TOKEN` if set, otherwise `~/.claude/.credentials.json` — and
sends it as an `Authorization: Bearer` header in exactly one request, to
`api.anthropic.com`. That is the only network call in this repo, and the token is
never written to disk, logged, or sent anywhere else. The cache file it writes
holds only a dollar amount and a timestamp.

`statusline.js` makes no network calls at all; it only reads the cache file and
runs one local `git status -sb`.

## Caveats

- **macOS credentials.** On macOS, Claude Code stores the OAuth token in the system Keychain rather than `~/.claude/.credentials.json`, so the fetcher won't find a token there. Export `CLAUDE_CODE_OAUTH_TOKEN` to make the account segment work; without it, that segment is simply omitted.
- **Enterprise plans.** The `spend` / `extra_usage` fields are populated for some account types and not others. If they're absent, the account segment is omitted.
