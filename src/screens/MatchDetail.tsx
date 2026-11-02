import { useState } from 'preact/hooks';
import { deleteMatch, reopenMatch, setScoreSide, type AppData } from '../db/repo';
import { reportText, setRecord, setsOf, shortDate } from '../domain';
import { showToast, useLeaveIfMissing } from '../hooks';
import { navigate, paths } from '../router';
import { eventsForMatch, eventsForSet, summarize } from '../stats/engine';
import { Shell } from '../ui/Shell';
import { PassDistribution, StatsCells, StatsHead, SummaryCard } from '../ui/StatCards';
import { CopyReportButton } from './Track';

function parseScore(raw: string): number | null {
  const v = raw.trim();
  if (v === '' || isNaN(Number(v))) return null;
  return Math.max(0, Math.round(Number(v)));
}

export function MatchDetailScreen({ data, matchId }: { data: AppData; matchId: string }) {
  const match = data.matches.find((m) => m.id === matchId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useLeaveIfMissing(!!match);
  if (!match) return <div class="inner body empty">Loading match…</div>;

  const matchSets = setsOf(data.sets, match.id);
  const events = eventsForMatch(data.events, match.id);
  const stats = summarize(events);
  const record = setRecord(matchSets).label;
  const name = data.player?.name || 'Son';
  const who = name + (data.player?.jersey ? ` #${data.player.jersey}` : '');

  const remove = async () => {
    await deleteMatch(match.id);
    showToast('Match deleted');
    navigate(paths.matches);
  };
  const reopen = async () => {
    await reopenMatch(match.id);
    navigate(paths.track(match.id));
  };

  return (
    <Shell title={`${name}’s Stats`} sub="Match details">
      <div>
        <button class="ghost" onClick={() => navigate(paths.matches)}>
          ← Matches
        </button>
      </div>
      <div>
        <h1>vs {match.opponent}</h1>
        <div class="note" style="margin-top:4px">
          {shortDate(match.matchDate)}
          {match.event ? ` · ${match.event}` : ''} · {who}
          {match.done ? ` · Final${record ? ' ' + record : ''}` : ''}
        </div>
      </div>

      {match.done ? (
        <button class="big g-blue" onClick={reopen}>
          Reopen match
        </button>
      ) : (
        <button class="big g-green" onClick={() => navigate(paths.track(match.id))}>
          Track this match →
        </button>
      )}

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
                  <td>Set {s.setNumber}</td>
                  <StatsCells s={summarize(eventsForSet(events, s.id))} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card form">
        <h2>Set scores</h2>
        {matchSets.map((s) => (
          <div class="row" style="align-items:center" key={s.id}>
            <span style="flex:1;font-weight:600">Set {s.setNumber}</span>
            <span class="note" style="flex:0">Us</span>
            <input
              class="sc"
              inputMode="numeric"
              aria-label={`Set ${s.setNumber} our score`}
              defaultValue={s.scoreUs ?? ''}
              onChange={(e) => setScoreSide(s.id, 'us', parseScore(e.currentTarget.value))}
            />
            <span class="note" style="flex:0">Them</span>
            <input
              class="sc"
              inputMode="numeric"
              aria-label={`Set ${s.setNumber} their score`}
              defaultValue={s.scoreThem ?? ''}
              onChange={(e) => setScoreSide(s.id, 'them', parseScore(e.currentTarget.value))}
            />
          </div>
        ))}
      </div>

      <PassDistribution s={stats} />

      <CopyReportButton text={reportText(data.player, match, matchSets, data.events)} />

      <div class="card">
        <h2>Manage</h2>
        <div class="confirm">
          {confirmDelete ? (
            <>
              <span>Delete this match and all its stats?</span>
              <button class="ghost danger" onClick={remove}>
                Delete
              </button>
              <button class="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </>
          ) : (
            <button class="ghost danger" onClick={() => setConfirmDelete(true)}>
              Delete match
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}
