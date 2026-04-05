import { NextResponse } from "next/server";
import { promisify } from "util";
import { execFile as execFileCb } from "child_process";
import { getSessionData } from "@/lib/parser";

export const dynamic = "force-dynamic";

const execFile = promisify(execFileCb);

interface GitCommit { hash: string; shortHash: string; message: string; time: string; }
interface GitDiffResponse {
  supported: boolean; error?: string; commits: GitCommit[];
  stat: string; filesChanged: number; insertions: number; deletions: number;
}

function isValidSessionId(id: string): boolean { return /^[A-Za-z0-9_-]{1,128}$/.test(id); }
function isValidGitHash(hash: string): boolean { return /^[0-9a-f]{40}$/i.test(hash); }

function parseStat(stat: string): { filesChanged: number; insertions: number; deletions: number } {
  const match = stat.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  if (!match) return { filesChanged: 0, insertions: 0, deletions: 0 };
  return { filesChanged: parseInt(match[1] || "0", 10), insertions: parseInt(match[2] || "0", 10), deletions: parseInt(match[3] || "0", 10) };
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFile("git", args, { timeout: 5000, cwd });
  return stdout.trim();
}

const EMPTY: GitDiffResponse = { supported: true, commits: [], stat: "", filesChanged: 0, insertions: 0, deletions: 0 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");

  if (!sessionId) return NextResponse.json({ error: "Missing session parameter" }, { status: 400 });
  if (!isValidSessionId(sessionId)) return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });

  let sessionData;
  try {
    sessionData = getSessionData(sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ...EMPTY, supported: false, error: msg });
  }

  if (!sessionData) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const projectRoot = sessionData.projectRoot;
  if (!projectRoot) return NextResponse.json({ ...EMPTY, supported: false, error: "Project directory not found" });

  const { startTime, lastActivity } = sessionData;
  if (!startTime || !lastActivity) return NextResponse.json(EMPTY);

  try {
    let logOutput = "";
    try {
      logOutput = await git(projectRoot, ["log", "--pretty=format:%H|%s|%aI", `--since=${startTime}`, `--until=${lastActivity}`]);
    } catch {
      return NextResponse.json({ ...EMPTY, supported: false, error: "Not a git repository" });
    }

    if (!logOutput) return NextResponse.json(EMPTY);

    const commits: GitCommit[] = logOutput.split("\n").filter(Boolean).map((line) => {
      const [hash, message, time] = line.split("|");
      return { hash: hash || "", shortHash: (hash || "").slice(0, 7), message: message || "", time: time || "" };
    });

    if (commits.length === 0) return NextResponse.json(EMPTY);

    const firstHash = commits[commits.length - 1].hash;
    const lastHash = commits[0].hash;
    if (!isValidGitHash(firstHash) || !isValidGitHash(lastHash)) return NextResponse.json({ ...EMPTY, commits });

    let stat = "", filesChanged = 0, insertions = 0, deletions = 0;
    try {
      stat = await git(projectRoot, ["diff", `${firstHash}^`, lastHash, "--stat"]);
      ({ filesChanged, insertions, deletions } = parseStat(stat));
    } catch {
      try {
        stat = await git(projectRoot, ["diff", firstHash, "--stat"]);
        ({ filesChanged, insertions, deletions } = parseStat(stat));
      } catch {}
    }

    return NextResponse.json({ supported: true, commits, stat, filesChanged, insertions, deletions } satisfies GitDiffResponse);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return NextResponse.json({ ...EMPTY, supported: false, error: "git not available" });
    return NextResponse.json({ ...EMPTY, supported: false, error: "Git error" });
  }
}
