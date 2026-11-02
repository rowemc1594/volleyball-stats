import { useEffect, useRef, useState } from 'preact/hooks';
import type { AppData } from '../db/repo';
import { reportText, setRecord, setsOf, shortDate } from '../domain';
import { eventsForMatch, eventsForSet, summarize } from '../stats/engine';
import { fetchSharedStats } from '../sync/share';
import { Icon, Shell } from '../ui/Shell';
import { PassDistribution, StatsCells, StatsHead, SummaryCard } from '../ui/StatCards';
import { CopyReportButton } from './Track';

const REFRESH_MS = 20_000;

type Load =
  | { state: 'loading' }
  | { state: 'ready'; data: AppData; at: Date }
  | { state: 'revoked' }
  | { state: 'unavailable' };

/**
 * Read-only stats from a share link. Nothing here writes: no taps, no forms, and the data is
 * held in memory only, never saved into this device's own database.
 */
export function ViewerScreen({ token }: { token: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [matchId, setMatchId] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const refreshRef = useRef<() => void>(() => {});

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const r = await fetchSharedStats(token);
      if (!alive) return;
      if (r.ok) {
        setStale(false);
        setLoad({ state: 'ready', data: r.data, at: new Date() });
      } else if (r.reason === 'revoked') {
        setLoad({ state: 'revoked' }); // access ends the moment the owner revokes the link
      } else {
        // Keep showing the last good copy if there is one.
        setStale(true);
        setLoad((cur) => (cur.state === 'ready' ? cur : { state: 'unavailable' }));
      }
    };
    void refresh();
    // Follow a match that is being tracked live: refresh while visible and when coming back.
    const timer = setInterval(() => document.visibilityState === 'visible' && void refresh(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    refreshRef.current = () => void refresh();
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  if (load.state === 'loading') {
    return (
      <Shell viewer title="Shared stats" sub="Read-only">
        <div class="empty">Loading…</div>
      </Shell>
    );
  }
  if (load.state === 'revoked') {
    return (
      <Shell viewer title="Shared stats" sub="Read-only">
        <div class="card form">
          <h2>This link is no longer active</h2>
          <div class="note">The person who shared it turned it off, or the link is not right. Ask them for a new one.</div>
        </div>
      </Shell>
    );
  }
  if (load.state === 'unavailable') {
    return (
      <Shell viewer title="Shared stats" sub="Read-only">
        <div class="card form">
          <h2>Can’t load the stats</h2>
          <div class="note">Check your connection and try again.</div>
          <button class="big g-blue" onClick={() => refreshRef.current()}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const { data, at } = load;
  const name = data.player?.name || 'Player';
  const who = name + (data.player?.jersey ? ` #${data.player.jersey}` : '');
  const updated = `${stale ? 'Offline, showing ' : ''}updated ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const refreshBtn = (
    <button
      class="hbtn"
      aria-label="Refresh"
      onClick={() => refreshRef.current()}
    >
      <Icon d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" size={18} />
    </button>
  );

  const match = matchId ? data.matches.find((m) => m.id === matchId) : undefined;
  if (match) {
    const matchSets = setsOf(data.sets, match.id);
    const events = eventsForMatch(data.events, match.id);
    const stats = summarize(events);
    const record = setRecord(matchSets).label;
    return (
      <Shell viewer back onBack={() => setMatchId(null)} title={`${name}’s Stats`} sub={`vs ${match.opponent} · Read-only`} right={refreshBtn}>
        <div>
          <h1>vs {match.opponent}</h1>
          <div class="note" style="margin-top:4px">
            {shortDate(match.matchDate)}
            {match.event ? ` · ${match.event}` : ''} · {who}
            {match.done ? ` · Final${record ? ' ' + record : ''}` : ' · In progress'}
          </div>
        </div>
        <SummaryCard s={stats} />
        <div class="card">
          <h2>By set</h2>
          <div class="tbl">
            <table>
              <thead>
                <StatsHead first="Set" />
              </thead>
              <tbody>
                {matchSets.map((s) => (
                  <tr key={s.id}>
                    <td>
                      Set {s.setNumber}
                      {s.scoreUs != null || s.scoreThem != null ? ` · ${s.scoreUs ?? '-'}–${s.scoreThem ?? '-'}` : ''}
                    </td>
                    <StatsCells s={summarize(eventsForSet(events, s.id))} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <PassDistribution s={stats} />
        <CopyReportButton text={reportText(data.player, match, matchSets, data.events)} />
        <div class="note">{updated}</div>
      </Shell>
    );
  }

  const season = summarize(data.events);
  const n = data.matches.length;
  return (
    <Shell viewer title={`${name}’s Stats`} sub="Shared view · Read-only" right={refreshBtn}>
      <div>
        <h1>{who}</h1>
        <div class="note" style="margin-top:4px">
          Season · {n} match{n === 1 ? '' : 'es'}
        </div>
      </div>
      <SummaryCard s={season} />
      <PassDistribution s={season} />
      <div class="card">
        <h2>By match</h2>
        {n ? (
          <>
            <div class="tbl">
              <table>
                <thead>
                  <StatsHead first="Match" />
                </thead>
                <tbody>
                  {data.matches.map((m) => (
                    <tr class="click" key={m.id} onClick={() => setMatchId(m.id)}>
                      <td>
                        {shortDate(m.matchDate)} · {m.opponent}
                      </td>
                      <StatsCells s={summarize(eventsForMatch(data.events, m.id))} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div class="note" style="margin-top:8px">
              Tap a match for set-by-set stats.
            </div>
          </>
        ) : (
          <div class="empty">No matches yet.</div>
        )}
      </div>
      <div class="note">{updated}</div>
    </Shell>
  );
}
