#!/usr/bin/env node
const { execSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

let data = {};
try {
  data = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch (e) {
  data = {};
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const CYAN_DIM = "\x1b[38;5;66m"; // muted teal — model effort level
const TIME = "\x1b[38;5;103m"; // muted periwinkle — API (compute) duration
const TIME_DIM = "\x1b[38;5;60m"; // same hue, darker — wall-clock duration
const GREEN = "\x1b[38;5;28m";
const GREEN_DIM = "\x1b[38;5;22m"; // same hue, darker — context window capacity
const SEP = "\x1b[38;5;245m"; // mid gray, matches the built-in mode line dots
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const PINK = "\x1b[38;5;161m";

const parts = [];

const modelName = data.model?.display_name || data.model?.id || "?";
parts.push(`${CYAN}${modelName}${RESET}`);

const effort = data.effort?.level;
if (effort) {
  parts.push(`${CYAN_DIM}${effort}${RESET}`);
}

const ctx = data.context_window;
let usedPct = ctx?.used_percentage;
if (usedPct == null && ctx?.current_usage && ctx?.context_window_size) {
  const u = ctx.current_usage;
  const used =
    (u.input_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0);
  usedPct = (used / ctx.context_window_size) * 100;
}
const fmtTokens = (n) =>
  n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`;

const winSize = ctx?.context_window_size;
let usedTokens = ctx?.total_input_tokens;
if (usedTokens == null && ctx?.current_usage) {
  const u = ctx.current_usage;
  usedTokens =
    (u.input_tokens || 0) +
    (u.cache_creation_input_tokens || 0) +
    (u.cache_read_input_tokens || 0);
}

const BAR_WIDTH = 10;
if (usedPct != null) {
  const pct = Math.round(usedPct);
  const color = pct >= 85 ? RED : pct >= 60 ? YELLOW : GREEN;
  const filled = Math.round((Math.min(pct, 100) / 100) * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const usedLabel = usedTokens != null ? fmtTokens(usedTokens) : `${pct}%`;
  const cap = winSize ? `${GREEN_DIM}/${fmtTokens(winSize)}${RESET}` : "";
  parts.push(`${color}${bar} ${usedLabel}${RESET}${cap}`);
} else {
  parts.push(`${DIM}${"░".repeat(BAR_WIDTH)} ?${RESET}`);
}

const GOLD = "\x1b[38;5;178m"; // muted gold — session (more visible of the two)
const GOLD_DIM = "\x1b[38;5;94m"; // darker brownish gold — account (less visible)
const USAGE_STALE_MARK_MS = 2 * 60 * 1000; // mark ~stale after 2 min: other sessions/this session's own new cost may not be reflected yet
const USAGE_REFETCH_MS = 30 * 60 * 1000; // but only actually re-fetch every 30 min
const home = os.homedir();
const CACHE_PATH = path.join(home, ".claude", ".statusline-usage-cache.json");
const LOCK_PATH = CACHE_PATH + ".lock";
const FETCHER_PATH = path.join(home, ".claude", "statusline-usage-fetch.js");

let usageCache = null;
try {
  usageCache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
} catch (e) {}

const cacheAge = usageCache ? Date.now() - usageCache.updatedAt : Infinity;
const acctIsStale = cacheAge > USAGE_STALE_MARK_MS; // shown as ~ well before the next actual refetch

const cost = data.cost?.total_cost_usd;
const sessionStr =
  typeof cost === "number" ? `${GOLD}$${(cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2))}${RESET}` : null;
const acctStr =
  typeof usageCache?.amountUsd === "number"
    ? `${GOLD_DIM}${acctIsStale ? "~" : ""}$${usageCache.amountUsd.toFixed(2)}${RESET}`
    : null;

if (sessionStr && acctStr) {
  parts.push(`${sessionStr}${GOLD_DIM}/${RESET}${acctStr}`);
} else if (sessionStr || acctStr) {
  parts.push(sessionStr || acctStr);
}

const fmtDur = (ms) => {
  const mins = Math.floor(ms / 60000);
  if (mins >= 60) {
    const rem = mins % 60;
    return `${Math.floor(mins / 60)}h${rem ? `${rem}m` : ""}`;
  }
  return mins >= 1 ? `${mins}m` : `${Math.round(ms / 1000)}s`;
};

const apiMs = data.cost?.total_api_duration_ms;
const wallMs = data.cost?.total_duration_ms;
const hasApi = typeof apiMs === "number" && apiMs > 0;
const hasWall = typeof wallMs === "number" && wallMs > 0;
if (hasApi && hasWall) {
  parts.push(`${TIME}${fmtDur(apiMs)}${RESET}${TIME_DIM}/${fmtDur(wallMs)}${RESET}`);
} else if (hasApi || hasWall) {
  parts.push(`${TIME}${fmtDur(hasApi ? apiMs : wallMs)}${RESET}`);
}

const needsRefetch = cacheAge > USAGE_REFETCH_MS;
if (needsRefetch) {
  let lockFresh = false;
  try {
    lockFresh = Date.now() - fs.statSync(LOCK_PATH).mtimeMs < 60000;
  } catch (e) {}
  if (!lockFresh) {
    try {
      fs.writeFileSync(LOCK_PATH, String(Date.now()));
      const child = spawn(
        process.execPath,
        [FETCHER_PATH, data.version || "2.1.276"],
        { detached: true, stdio: "ignore" }
      );
      child.unref();
    } catch (e) {}
  }
}

const cwd = data.workspace?.current_dir || data.cwd;
if (cwd) {
  try {
    // Single git process returns both branch and dirty state
    const lines = execSync("git status -sb", {
      cwd,
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .split("\n");
    const header = lines[0] || "";
    let branch = header.startsWith("## ") ? header.slice(3).split("...")[0].trim() : "";
    if (branch.startsWith("HEAD")) branch = ""; // detached
    if (branch) {
      const dirty = lines.slice(1).some((l) => l.trim()) ? `${YELLOW}*${RESET}` : "";
      parts.push(`${PINK}${branch}${RESET}${dirty}`);
    }
  } catch (e) {}
}

console.log(parts.join(`${SEP} · ${RESET}`));
