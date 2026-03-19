"use client";

import type { TimelineEvent } from "@/lib/types";
import { useRef, useEffect, useState } from "react";
import { Modal } from "./Modal";

const TYPE_COLORS: Record<string, string> = {
  user: "#3b82f6",      // strong blue
  assistant: "#a78bfa",  // purple
  tool: "#fb923c",       // orange
  agent: "#f472b6",      // pink — very distinct from blue
};

const TYPE_LABELS: Record<string, string> = {
  user: "User",
  assistant: "Response",
  tool: "Tool Call",
  agent: "Agent",
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTime(ts: string): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ConversationTimeline({ events }: { events: TimelineEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)] text-xs">
        No events yet
      </div>
    );
  }

  const startTime = new Date(events[0].timestamp).getTime();
  const endTime = new Date(events[events.length - 1].timestamp).getTime();
  const duration = endTime - startTime || 1;

  // Compute stats for the modal
  const eventsByType = (type: string) => events.filter((e) => e.type === type);
  const toolBreakdown = events
    .filter((e) => e.toolName)
    .reduce((acc, e) => {
      acc[e.toolName!] = (acc[e.toolName!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-5">
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-[var(--text-secondary)]">{TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>

      {/* Timeline strip */}
      <div ref={scrollRef} className="overflow-x-auto pb-5">
        <div className="relative min-w-full pl-20" style={{ height: 80 }}>
          {/* Time axis */}
          <div className="absolute bottom-0 left-20 right-0 h-px bg-[var(--border)]" />

          {/* Start/end labels */}
          <div className="absolute bottom-[-18px] left-20 text-[9px] text-[var(--text-secondary)]">
            {formatTime(events[0].timestamp)}
          </div>
          <div className="absolute bottom-[-18px] right-0 text-[9px] text-[var(--text-secondary)]">
            {formatTime(events[events.length - 1].timestamp)}
          </div>

          {/* Event dots */}
          {events.map((event, i) => {
            const eventTime = new Date(event.timestamp).getTime();
            const position = ((eventTime - startTime) / duration) * 100;
            const color = TYPE_COLORS[event.type] || "#8888a4";

            const yOffset =
              event.type === "user" ? 10 :
              event.type === "assistant" ? 28 :
              event.type === "tool" ? 46 :
              55;

            const size = event.type === "user" ? 9 :
              event.cost && event.cost > 0.1 ? 7 :
              5;

            return (
              <div
                key={i}
                className="group absolute cursor-pointer"
                style={{
                  left: `${Math.min(Math.max(position, 1), 99)}%`,
                  top: yOffset,
                  transform: "translateX(-50%)",
                }}
                onClick={() => setSelectedEvent(event)}
              >
                <div
                  className="rounded-full transition-transform hover:scale-[2]"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: color,
                    opacity: event.type === "tool" ? 0.8 : 1,
                  }}
                />
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 z-10">
                  <div className="whitespace-nowrap rounded bg-[var(--bg-primary)] border border-[var(--border)] px-2 py-1 text-[10px] shadow-lg">
                    <div style={{ color }}>{TYPE_LABELS[event.type]}</div>
                    {event.toolName && <div className="text-[var(--text-primary)]">{event.toolName}</div>}
                    {event.cost != null && <div className="text-[var(--accent-green)]">${event.cost.toFixed(4)}</div>}
                    <div className="text-[var(--text-secondary)]">{formatTime(event.timestamp)}</div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Row labels — full words */}
          <div className="absolute left-0 top-[6px] text-[10px] text-[var(--text-secondary)]" style={{ color: TYPE_COLORS.user }}>User</div>
          <div className="absolute left-0 top-[24px] text-[10px] text-[var(--text-secondary)]" style={{ color: TYPE_COLORS.assistant }}>Assistant</div>
          <div className="absolute left-0 top-[42px] text-[10px] text-[var(--text-secondary)]" style={{ color: TYPE_COLORS.tool }}>Tool Call</div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
        <span>{eventsByType("user").length} user messages</span>
        <span>{eventsByType("assistant").length} responses</span>
        <span>{eventsByType("tool").length} tool calls</span>
        <span>
          Duration:{" "}
          {duration < 60000
            ? `${Math.round(duration / 1000)}s`
            : `${Math.round(duration / 60000)}m`}
        </span>
      </div>

      {/* Detail Modal */}
      <Modal
        open={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title="Event Details"
      >
        {selectedEvent && (
          <div className="space-y-5">
            {/* Event info */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[selectedEvent.type] }}
                />
                <span className="text-sm font-semibold" style={{ color: TYPE_COLORS[selectedEvent.type] }}>
                  {TYPE_LABELS[selectedEvent.type]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider mb-0.5">Time</div>
                  <div>{formatFullTime(selectedEvent.timestamp)}</div>
                </div>
                {selectedEvent.model && (
                  <div>
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider mb-0.5">Model</div>
                    <div>{selectedEvent.model}</div>
                  </div>
                )}
                {selectedEvent.cost != null && (
                  <div>
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider mb-0.5">Cost</div>
                    <div className="text-[var(--accent-green)] font-semibold">${selectedEvent.cost.toFixed(4)}</div>
                  </div>
                )}
                {selectedEvent.toolName && (
                  <div>
                    <div className="text-[var(--text-secondary)] text-[10px] uppercase tracking-wider mb-0.5">Tool</div>
                    <div className="text-[var(--accent-orange)]">{selectedEvent.toolName}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Session tool breakdown */}
            <div>
              <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Session Tool Breakdown</div>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(toolBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] px-3 py-2 text-xs">
                      <span>{tool}</span>
                      <span className="font-semibold text-[var(--accent-orange)]">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
