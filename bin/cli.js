#!/usr/bin/env node

const path = require("path");
const fs = require("fs");
const { execSync, spawn } = require("child_process");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const PORT = process.env.PORT || 3141;

// Handle --help and --version
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
  Claude Code Insights — Real-time analytics dashboard for Claude Code sessions

  Usage:
    npx claude-code-insights [options]

  Options:
    -p, --port <port>  Port to run on (default: 3141, or PORT env var)
    -h, --help         Show this help message
    -v, --version      Show version number
  `);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")
  );
  console.log(pkg.version);
  process.exit(0);
}

// Parse --port / -p flag
const portFlagIndex = args.findIndex((a) => a === "--port" || a === "-p");
const port = portFlagIndex !== -1 ? args[portFlagIndex + 1] : PORT;

// Resolve the next binary from the package's own node_modules
const nextBin = path.join(PACKAGE_ROOT, "node_modules", ".bin", "next");

// Build if .next doesn't exist
const nextDir = path.join(PACKAGE_ROOT, ".next");
if (!fs.existsSync(nextDir)) {
  console.log("\n  Building Claude Code Insights (first run only)...\n");
  try {
    execSync(`"${nextBin}" build`, {
      cwd: PACKAGE_ROOT,
      stdio: "inherit",
    });
  } catch {
    console.error("\n  Build failed. Please report this issue at:");
    console.error(
      "  https://github.com/anthropics/claude-code-insights/issues\n"
    );
    process.exit(1);
  }
}

// Start the server
const url = `http://localhost:${port}`;
console.log(`\n  Claude Code Insights`);
console.log(`  Ready at ${url}\n`);

const server = spawn(nextBin, ["start", "-p", String(port)], {
  cwd: PACKAGE_ROOT,
  stdio: "inherit",
});

// Open browser after server has time to start
setTimeout(() => {
  const openCmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    execSync(`${openCmd} ${url}`, { stdio: "ignore" });
  } catch {
    // Browser open is best-effort
  }
}, 1500);

// Graceful shutdown
function cleanup() {
  server.kill();
  process.exit();
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
