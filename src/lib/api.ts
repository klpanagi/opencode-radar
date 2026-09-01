import { NextResponse } from "next/server";
import { getDbPath, isDbNotFoundError } from "@/lib/parser";

/** Shape returned by every API route when the OpenCode DB is missing. */
export interface DbMissingInfo {
  error: string;
  dbPath: string;
  hint: string;
}

/** Payload returned when the OpenCode database file is missing. */
export function dbMissingPayload(): DbMissingInfo {
  return {
    error: "OpenCode database not found. Have you run opencode at least once?",
    dbPath: getDbPath(),
    hint: "Run `opencode` once to create your database, then refresh this page.",
  };
}

let warnedOnce = false;

/**
 * True when `err` is the typed missing-database error. Logs a single friendly
 * warning (no stack trace) so a missing DB does not spam server logs with
 * 500 stack traces on every 3s poll.
 */
export function isDbMissing(err: unknown): boolean {
  if (!isDbNotFoundError(err)) return false;
  if (!warnedOnce) {
    warnedOnce = true;
    console.warn(
      `[opencode-radar] OpenCode database not found at ${getDbPath()}. ` +
        "API routes are returning 503; run `opencode` once to create it."
    );
  }
  return true;
}

/** 503 JSON response for a missing database. */
export function dbMissingResponse(): NextResponse {
  return NextResponse.json(dbMissingPayload(), { status: 503 });
}
