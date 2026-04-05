#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync, spawn } = require("child_process");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(os.homedir(), ".opencode-radar");
const PORT = process.env.PORT || 3141;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  OpenCode Radar — Real-time radar for your OpenCode sessions

  Usage:
    npx opencode-radar [options]

  Options:
    -p, --port <port>  Port to run on (default: 3141, or PORT env var)
    -h, --help         Show this help message
    -v, --version      Show version number
    --rebuild          Force a fresh build

  Prerequisites:
    - opencode installed and used at least once
    - Node.js 18+
  `);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  console.log(pkg.version);
  process.exit(0);
}

const portFlagIndex = args.findIndex((a) => a === "--port" || a === "-p");
const port = portFlagIndex !== -1 ? args[portFlagIndex + 1] : PORT;
const forceRebuild = args.includes("--rebuild");

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")).version;
}

function getCachedVersion() {
  try { return fs.readFileSync(path.join(CACHE_DIR, ".version"), "utf8").trim(); } catch { return null; }
}

function setupApp() {
  const version = getPackageVersion();
  const needsFullRebuild = forceRebuild || getCachedVersion() !== version;
  if (needsFullRebuild && fs.existsSync(CACHE_DIR)) fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  copyDirSync(path.join(PACKAGE_ROOT, "src"), path.join(CACHE_DIR, "src"));
  for (const file of ["next.config.ts", "tsconfig.json", "postcss.config.mjs", "package.json"]) {
    const src = path.join(PACKAGE_ROOT, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(CACHE_DIR, file));
  }
  const cacheNodeModules = path.join(CACHE_DIR, "node_modules");
  if (!fs.existsSync(cacheNodeModules)) {
    const hoistedNodeModules = path.dirname(path.dirname(require.resolve("next/package.json")));
    fs.symlinkSync(hoistedNodeModules, cacheNodeModules, "dir");
  }
  fs.writeFileSync(path.join(CACHE_DIR, ".version"), version);
}

const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist", "bin", "next");
const needsSetup = forceRebuild || getCachedVersion() !== getPackageVersion() || !fs.existsSync(CACHE_DIR);
if (needsSetup) setupApp();

const nextDir = path.join(CACHE_DIR, ".next");
if (!fs.existsSync(nextDir)) {
  console.log("\n  Building OpenCode Radar (first run only)...\n");
  try {
    execSync(`node "${nextBin}" build`, { cwd: CACHE_DIR, stdio: "inherit" });
  } catch {
    console.error("\n  Build failed. Please report this issue.\n");
    process.exit(1);
  }
}

const url = `http://localhost:${port}`;
console.log(`\n  OpenCode Radar`);
console.log(`  Ready at ${url}\n`);

const server = spawn("node", [nextBin, "start", "-p", String(port)], { cwd: CACHE_DIR, stdio: "inherit" });

setTimeout(() => {
  const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { execSync(`${openCmd} ${url}`, { stdio: "ignore" }); } catch {}
}, 1500);

function cleanup() { server.kill(); process.exit(); }
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
