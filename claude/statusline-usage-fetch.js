#!/usr/bin/env node
// Standalone, detached background refresher for the account-wide usage/spend
// figure shown in the status line. Never invoked synchronously from
// statusline.js — spawned detached so it can't slow down the prompt.
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");

const home = os.homedir();
const CRED_PATH = path.join(home, ".claude", ".credentials.json");
const CACHE_PATH = path.join(home, ".claude", ".statusline-usage-cache.json");
const LOCK_PATH = CACHE_PATH + ".lock";

const version = process.argv[2] || "2.1.276";

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  } catch (e) {
    return null;
  }
}

function writeCache(obj) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(obj));
}

function releaseLock() {
  try {
    fs.unlinkSync(LOCK_PATH);
  } catch (e) {}
}

// Env var first (works on macOS, where credentials live in the Keychain rather
// than a credentials file), then the on-disk credentials file (Linux/Windows).
let token = process.env.CLAUDE_CODE_OAUTH_TOKEN || null;
if (!token) {
  try {
    const creds = JSON.parse(fs.readFileSync(CRED_PATH, "utf8"));
    token = creds?.claudeAiOauth?.accessToken || null;
  } catch (e) {
    token = null;
  }
}

if (!token) {
  const existing = readCache();
  if (!existing) writeCache({ updatedAt: Date.now(), amountUsd: null, error: "no-token" });
  releaseLock();
  process.exit(0);
}

const req = https.request(
  {
    hostname: "api.anthropic.com",
    path: "/api/oauth/usage",
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": `claude-code/${version}`,
    },
    timeout: 5000,
  },
  (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      try {
        if (res.statusCode !== 200) throw new Error(`http ${res.statusCode}`);
        const data = JSON.parse(body);
        let amountUsd = null;
        if (data.spend?.used?.amount_minor != null) {
          amountUsd = data.spend.used.amount_minor / Math.pow(10, data.spend.used.exponent ?? 2);
        } else if (data.extra_usage?.used_credits != null) {
          amountUsd = data.extra_usage.used_credits / Math.pow(10, data.extra_usage.decimal_places ?? 2);
        }
        writeCache({ updatedAt: Date.now(), amountUsd, error: null });
      } catch (e) {
        const existing = readCache();
        if (!existing) writeCache({ updatedAt: Date.now(), amountUsd: null, error: String(e.message || e) });
      } finally {
        releaseLock();
      }
    });
  }
);

req.on("error", () => {
  const existing = readCache();
  if (!existing) writeCache({ updatedAt: Date.now(), amountUsd: null, error: "network-error" });
  releaseLock();
});
req.on("timeout", () => req.destroy());
req.end();
