"use client";

import type { ProjectInfo } from "@/lib/types";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function SessionPicker({
  projects,
  selectedProject,
  selectedSession,
  onSelect,
}: {
  projects: ProjectInfo[];
  selectedProject: string | null;
  selectedSession: string | null;
  onSelect: (projectPath: string, sessionId: string) => void;
}) {
  return (
    <div className="space-y-3 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
      {projects.map((project) => (
        <div key={project.path}>
          <div className="mb-1.5 flex items-center gap-2 px-1">
            <svg className="h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              {project.name}
            </span>
          </div>
          <div className="space-y-1">
            {project.sessions.map((session) => {
              const isSelected =
                selectedProject === project.path && selectedSession === session.id;
              return (
                <button
                  key={session.id}
                  onClick={() => onSelect(project.path, session.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-all ${
                    isSelected
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]10 glow-blue"
                      : "border-transparent bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[var(--text-primary)]">
                      {session.id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {formatDate(session.modifiedAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
                    {formatSize(session.size)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
