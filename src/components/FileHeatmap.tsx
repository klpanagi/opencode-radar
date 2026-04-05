"use client";

import { useState } from "react";
import type { FileActivity } from "@/lib/types";
import { Modal } from "./Modal";

function getHeatColor(intensity: number): string {
  if (intensity > 0.8) return "#f87171";
  if (intensity > 0.6) return "#fb923c";
  if (intensity > 0.4) return "#fbbf24";
  if (intensity > 0.2) return "#4ade80";
  return "#60a5fa";
}

export function FileHeatmap({ files }: { files: FileActivity[] }) {
  const [selectedFile, setSelectedFile] = useState<FileActivity | null>(null);

  if (files.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)] text-xs">
        No file activity
      </div>
    );
  }

  const maxTotal = files[0]?.total || 1;
  const displayFiles = files.slice(0, 20);

  const totalReads = files.reduce((s, f) => s + f.reads, 0);
  const totalEdits = files.reduce((s, f) => s + f.edits, 0);
  const totalWrites = files.reduce((s, f) => s + f.writes, 0);

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#60a5fa]" />
          <span className="text-[var(--text-secondary)]">Read</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#a78bfa]" />
          <span className="text-[var(--text-secondary)]">Edit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80]" />
          <span className="text-[var(--text-secondary)]">Write</span>
        </div>
        <span className="text-[var(--text-secondary)] ml-auto">
          {totalReads} reads, {totalEdits} edits, {totalWrites} writes
        </span>
      </div>

      <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
        {displayFiles.map((file) => {
          const intensity = file.total / maxTotal;
          const color = getHeatColor(intensity);

          return (
            <div
              key={file.path}
              className="flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--bg-card-hover)]"
              style={{
                background: `linear-gradient(90deg, ${color}08 0%, ${color}03 100%)`,
                borderLeft: `3px solid ${color}`,
              }}
              onClick={() => setSelectedFile(file)}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-mono text-[var(--text-primary)]">
                  {file.shortPath}
                </div>
                <div className="mt-1 flex items-center gap-3">
                  {file.reads > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />
                      <span className="text-[#60a5fa]">{file.reads} read{file.reads !== 1 ? "s" : ""}</span>
                    </span>
                  )}
                  {file.edits > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
                      <span className="text-[#a78bfa]">{file.edits} edit{file.edits !== 1 ? "s" : ""}</span>
                    </span>
                  )}
                  {file.writes > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
                      <span className="text-[#4ade80]">{file.writes} write{file.writes !== 1 ? "s" : ""}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-bold" style={{ color }}>
                  {file.total}
                </div>
                <div className="text-[9px] text-[var(--text-secondary)]">ops</div>
              </div>
            </div>
          );
        })}

        {files.length > 20 && (
          <div className="px-3 py-1 text-[10px] text-[var(--text-secondary)]">
            +{files.length - 20} more files
          </div>
        )}
      </div>

      {/* File Detail Modal */}
      <Modal
        open={selectedFile !== null}
        onClose={() => setSelectedFile(null)}
        title="File Activity Details"
      >
        {selectedFile && (
          <div className="space-y-5">
            {/* Full path */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">Full Path</div>
              <div className="font-mono text-xs text-[var(--text-primary)] break-all">
                {selectedFile.path}
              </div>
            </div>

            {/* Operation breakdown */}
            <div>
              <div className="text-xs font-semibold mb-3 text-[var(--text-secondary)]">Operations</div>
              <div className="grid grid-cols-3 gap-3">
                <OperationCard
                  label="Reads"
                  description="File was read/viewed by OpenCode"
                  count={selectedFile.reads}
                  color="#60a5fa"
                  total={selectedFile.total}
                />
                <OperationCard
                  label="Edits"
                  description="File was modified in-place"
                  count={selectedFile.edits}
                  color="#a78bfa"
                  total={selectedFile.total}
                />
                <OperationCard
                  label="Writes"
                  description="File was created or fully rewritten"
                  count={selectedFile.writes}
                  color="#4ade80"
                  total={selectedFile.total}
                />
              </div>
            </div>

            {/* Churn indicator */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Churn Analysis</div>
              {selectedFile.edits + selectedFile.writes > 3 ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-[#f87171]" />
                  <span className="text-[#f87171]">High churn</span>
                  <span className="text-[var(--text-secondary)]">
                    — This file was modified {selectedFile.edits + selectedFile.writes} times. It may need refactoring or the approach kept changing.
                  </span>
                </div>
              ) : selectedFile.edits + selectedFile.writes > 1 ? (
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
                  <span className="text-[#fbbf24]">Moderate churn</span>
                  <span className="text-[var(--text-secondary)]">
                    — Modified {selectedFile.edits + selectedFile.writes} times. Normal iteration.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full bg-[#4ade80]" />
                  <span className="text-[#4ade80]">Clean</span>
                  <span className="text-[var(--text-secondary)]">
                    — Touched only {selectedFile.edits + selectedFile.writes} time. No excessive rework.
                  </span>
                </div>
              )}
            </div>

            {/* Read-to-write ratio */}
            {selectedFile.reads > 0 && (selectedFile.edits > 0 || selectedFile.writes > 0) && (
              <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
                <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Read-to-Modify Ratio</div>
                <div className="text-xs text-[var(--text-primary)]">
                  Read {selectedFile.reads} time{selectedFile.reads !== 1 ? "s" : ""} before making{" "}
                  {selectedFile.edits + selectedFile.writes} modification{selectedFile.edits + selectedFile.writes !== 1 ? "s" : ""}.
                  {selectedFile.reads > (selectedFile.edits + selectedFile.writes) * 2
                    ? " OpenCode studied this file carefully before changing it."
                    : " Quick read-then-modify pattern."}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function OperationCard({
  label,
  description,
  count,
  color,
  total,
}: {
  label: string;
  description: string;
  count: number;
  color: string;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color }}>
        {count}
      </div>
      <div className="text-[9px] text-[var(--text-secondary)] mb-2">{description}</div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-1 text-[9px] text-[var(--text-secondary)]">{pct.toFixed(0)}% of ops</div>
    </div>
  );
}
