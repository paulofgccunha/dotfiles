// Adds (or with --remove, deletes) the statusLine block in ~/.claude/settings.json,
// leaving every other key untouched.
import fs from "fs";
import os from "os";
import path from "path";

const remove = process.argv.includes("--remove");
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const snippetPath = path.join(here, "settings-statusline-snippet.json");
const settingsPath = path.join(os.homedir(), ".claude", "settings.json");

if (!fs.existsSync(settingsPath)) {
  if (remove) {
    console.log(`No ${settingsPath} — nothing to remove.`);
    process.exit(0);
  }
  fs.writeFileSync(settingsPath, JSON.stringify({}, null, 2) + "\n");
}

// Byte-exact backup, taken before anything is parsed or rewritten
fs.copyFileSync(settingsPath, settingsPath + ".bak");
console.log(`Backed up existing settings to ${settingsPath}.bak`);

const raw = fs.readFileSync(settingsPath, "utf8").trim();
const settings = raw ? JSON.parse(raw) : {};

if (remove) {
  if (!("statusLine" in settings)) {
    console.log("No statusLine key present — nothing to remove.");
    process.exit(0);
  }
  delete settings.statusLine;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Removed statusLine config from ${settingsPath}`);
} else {
  const snippet = JSON.parse(fs.readFileSync(snippetPath, "utf8"));
  settings.statusLine = snippet.statusLine;
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`Wrote statusLine config into ${settingsPath}`);
}
