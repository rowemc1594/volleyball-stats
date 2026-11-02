import type { ComponentChildren } from 'preact';
import { navigate, paths } from '../router';
import { useToast } from '../hooks';
import { useSyncState } from '../sync/controller';

interface ShellProps {
  title: string;
  sub: string;
  /** Show a back arrow instead of the logo. */
  back?: boolean;
  right?: ComponentChildren;
  tabs?: ComponentChildren;
  /** Tighter spacing so every control fits one phone screen. */
  compact?: boolean;
  children: ComponentChildren;
}

export function Shell({ title, sub, back, right, tabs, compact, children }: ShellProps) {
  const toast = useToast();
  return (
    <div class="page">
      <div class="stick">
        <div class="inner">
          <div class="hdr">
            <button
              class={`logo${back ? ' back' : ''}`}
              aria-label={back ? 'Back to matches' : 'Matches home'}
              onClick={() => navigate(paths.matches)}
            >
              {back ? <Icon d="M15 6l-6 6 6 6" size={22} /> : '🏐'}
            </button>
            <div class="ttl">
              <div class="t1">{title}</div>
              <div class="t2">{sub}</div>
            </div>
            {right}
          </div>
          {tabs ? <div class="tabs">{tabs}</div> : null}
        </div>
      </div>
      {/* Only this area scrolls, so the header can never sit on top of the content. */}
      <div class="scroller">
        <div class={`inner body${compact ? ' compact' : ''}`}>{children}</div>
      </div>
      {toast ? (
        <div class="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

export function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export const ICON = {
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  list: 'M9 5h11M9 12h11M9 19h11M4.5 5h.01M4.5 12h.01M4.5 19h.01',
  chev: 'M9 6l6 6-6 6',
  x: 'M6 6l12 12M18 6L6 18',
};

/**
 * Always safe to tap: everything is saved on this device first. The chip says whether the
 * cloud copy is up to date: green dot = yes, text = changes waiting, grey = not signed in.
 */
export function SyncChip() {
  const s = useSyncState();
  if (s.phase === 'off' || s.phase === 'signed-out') {
    return <span class="sync off" title="Saved on this device only" role="img" aria-label="Saved on this device only" />;
  }
  if (s.phase === 'error') {
    return (
      <span class="sync err" title={s.error ?? 'Sync problem'} role="status">
        Sync error
      </span>
    );
  }
  if (s.pending > 0) {
    const label = s.phase === 'offline' ? `Offline · ${s.pending} to sync` : `${s.pending} to sync`;
    return (
      <span class="sync" role="status">
        {label}
      </span>
    );
  }
  if (s.phase === 'offline') {
    return <span class="sync" role="status">Offline</span>;
  }
  return <span class="sync ok" title="Saved and synced" role="img" aria-label="Saved and synced" />;
}

export function Tabs({ tab }: { tab: 'matches' | 'season' }) {
  return (
    <>
      <button class={`pill${tab === 'matches' ? ' on' : ''}`} onClick={() => navigate(paths.matches)}>
        Matches
      </button>
      <button class={`pill${tab === 'season' ? ' on' : ''}`} onClick={() => navigate(paths.season)}>
        Season
      </button>
    </>
  );
}
