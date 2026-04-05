"use client";

export function ConfigPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold">Settings</h2>
        <p className="text-xs text-[var(--text-secondary)]">
          OpenCode configuration is managed via its own CLI and config files.
        </p>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
        <svg className="mx-auto mb-3 h-10 w-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm text-[var(--text-secondary)]">
          Use the Budget tab to manage spending limits.
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          OpenCode settings are configured via{" "}
          <code className="rounded bg-[var(--bg-secondary)] px-1 py-0.5 text-[var(--accent-purple)]">
            ~/.config/opencode/config.json
          </code>
        </p>
      </div>
    </div>
  );
}
