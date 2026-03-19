"use client";

const TOOL_ICONS: Record<string, string> = {
  Read: "eye",
  Edit: "pencil",
  Write: "file-plus",
  Bash: "terminal",
  Glob: "search",
  Grep: "code",
  Agent: "users",
  WebSearch: "globe",
  WebFetch: "download",
};

const TOOL_COLORS: Record<string, string> = {
  Read: "#60a5fa",
  Edit: "#a78bfa",
  Write: "#4ade80",
  Bash: "#fb923c",
  Glob: "#fbbf24",
  Grep: "#f472b6",
  Agent: "#22d3ee",
  WebSearch: "#34d399",
  WebFetch: "#a3e635",
};

export function ToolUsage({ usage }: { usage: Record<string, number> }) {
  const tools = Object.entries(usage).sort((a, b) => b[1] - a[1]);
  const maxCount = tools[0]?.[1] || 1;

  if (tools.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        No tool usage
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {tools.map(([name, count]) => {
        const pct = (count / maxCount) * 100;
        const color = TOOL_COLORS[name] || "#8888a4";

        return (
          <div key={name} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-right text-xs text-[var(--text-secondary)]">
              {name}
            </span>
            <div className="flex-1">
              <div className="h-5 w-full overflow-hidden rounded bg-[var(--bg-secondary)]">
                <div
                  className="flex h-full items-center rounded px-2 transition-all duration-500"
                  style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color + "33" }}
                >
                  <span className="text-[10px] font-medium" style={{ color }}>
                    {count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
