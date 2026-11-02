import { useState } from 'preact/hooks';
import {
  addEvent,
  adjustScore,
  endSet,
  finishMatch,
  reopenMatch,
  undoEvent,
  type AppData,
  type SetScore,
} from '../db/repo';
import type { Match, SetRow } from '../db/schema';
import { dateParts, describeEvent, newestFirst, reportText, setRecord, setsOf } from '../domain';
import { showToast, useLeaveIfMissing } from '../hooks';
import { colourOf, HIT_KEYS, PASS_KEYS, SERVE_KEYS, type KeyDef } from '../keys';
import { navigate, paths } from '../router';
import { eventsForMatch, eventsForSet, formatPercent, summarize } from '../stats/engine';
import type { StatEvent } from '../stats/types';
import { Icon, ICON, SavedDot, Shell } from '../ui/Shell';
import { SummaryCard } from '../ui/StatCards';

type Selected = 'all' | number | null; // null follows the latest set

function sameStat(e: StatEvent, k: KeyDef) {
  return e.kind === k.input.kind && e.value === k.input.value;
}

interface BandProps {
  keys: KeyDef[];
  cols: 3 | 4;
  events: StatEvent[];
  live: boolean;
  pop: string | null;
  onTap: (k: KeyDef) => void;
}

function Keys({ keys, cols, events, live, pop, onTap }: BandProps) {
  return (
    <div class={`keys k${cols}`}>
      {keys.map((k) => {
        const id = `${k.input.kind}:${k.input.value}`;
        const count = events.filter((e) => sameStat(e, k)).length;
        const popping = pop?.startsWith(id + '#');
        return (
          <button
            key={id}
            class={`key g-${k.colour}`}
            disabled={!live}
            aria-label={`${k.input.kind} ${k.big}`}
            onClick={() => onTap(k)}
          >
            <b>{k.big}</b>
            <strong>{k.title}</strong>
            <small>{k.sub}</small>
            {/* New key on every tap restarts the pop animation */}
            <em class={`n${popping ? ' pop' : ''}`} key={popping ? pop : id}>
              {count}
            </em>
          </button>
        );
      })}
    </div>
  );
}

function Band({ colour, title, info, children }: { colour: string; title: string; info: string; children: preact.ComponentChildren }) {
  return (
    <div class="card">
      <div class="bhead">
        <div class="bt" style={`color:var(--${colour})`}>
          <span class="dot" style={`background:var(--${colour})`} />
          {title}
        </div>
        <div class="bi">{info}</div>
      </div>
      {children}
    </div>
  );
}

function EndSetSheet({
  match,
  set,
  onClose,
}: {
  match: Match;
  set: SetRow;
  onClose: () => void;
}) {
  const [us, setUs] = useState(set.scoreUs?.toString() ?? '');
  const [them, setThem] = useState(set.scoreThem?.toString() ?? '');
  const read = (): SetScore => {
    const num = (v: string) => (v.trim() === '' || isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v))));
    return { us: num(us), them: num(them) };
  };

  const next = async () => {
    await endSet(match.id, set.setNumber, read());
    onClose();
  };
  const finish = async () => {
    await finishMatch(match.id, set.setNumber, read());
    showToast('Match finished');
    navigate(paths.match(match.id));
  };

  return (
    <div class="sheet">
      <div class="card form sheetbox" role="dialog" aria-label={`End set ${set.setNumber}`}>
        <h2 style="margin:0">End Set {set.setNumber}</h2>
        <div class="note">Final score (optional)</div>
        <div class="row" style="align-items:center">
          <span class="note" style="flex:0">Us</span>
          <input
            class="sc"
            inputMode="numeric"
            aria-label="Our score"
            value={us}
            onInput={(e) => setUs(e.currentTarget.value)}
          />
          <span class="note" style="flex:0">Them</span>
          <input
            class="sc"
            inputMode="numeric"
            aria-label="Their score"
            value={them}
            onInput={(e) => setThem(e.currentTarget.value)}
          />
        </div>
        <button class="big g-green" onClick={next}>
          Start Set {set.setNumber + 1}
        </button>
        <button class="big g-blue" onClick={finish}>
          Finish match
        </button>
        <button class="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CopyReportButton({ text }: { text: string }) {
  const [fallback, setFallback] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Report copied');
    } catch {
      setFallback(true);
      showToast('Select and copy the text');
    }
  };
  return (
    <>
      <button class="btn2" onClick={copy}>
        📋 Copy Text Report
      </button>
      {fallback ? (
        <textarea
          readOnly
          class="fallback"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          ref={(el) => el?.select()}
        />
      ) : null}
    </>
  );
}

export function TrackScreen({ data, matchId }: { data: AppData; matchId: string }) {
  const match = data.matches.find((m) => m.id === matchId);
  const [selected, setSelected] = useState<Selected>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pop, setPop] = useState<string | null>(null);

  useLeaveIfMissing(!!match);
  if (!match) return <div class="inner body empty">Loading match…</div>;

  const matchSets = setsOf(data.sets, match.id);
  const latest = matchSets[matchSets.length - 1];
  const sel: 'all' | number = selected ?? latest.setNumber;
  const target = (sel === 'all' ? latest : matchSets.find((s) => s.setNumber === sel)) ?? latest;
  const live = !match.done;

  const matchEvents = eventsForMatch(data.events, match.id);
  const events = sel === 'all' ? matchEvents : eventsForSet(matchEvents, target.id);
  const stats = summarize(events);
  const history = newestFirst(events);
  const last = history[0];
  const dp = dateParts(match.matchDate);
  const record = setRecord(matchSets).label;

  const tap = (k: KeyDef) => {
    setPop(`${k.input.kind}:${k.input.value}#${Date.now()}`);
    addEvent(target.id, k.input).catch((err) => {
      console.error(err);
      showToast('Could not save that tap');
    });
  };
  const undo = (e: StatEvent) => {
    undoEvent(e.id);
    showToast(`Removed ${describeEvent(e)}`);
  };

  const band = { events, live, pop, onTap: tap };
  const name = data.player?.name || 'Son';

  return (
    <Shell
      back
      title={`${name}’s Stats`}
      sub={`vs ${match.opponent} · ${dp.month} ${dp.day}`}
      right={
        <>
          <SavedDot />
          <button class="hbtn" disabled={!last || !live} onClick={() => last && undo(last)}>
            <Icon d={ICON.undo} size={16} /> Undo
          </button>
          <button class="hbtn" aria-label="Match details" onClick={() => navigate(paths.match(match.id))}>
            <Icon d={ICON.list} />
          </button>
        </>
      }
      tabs={
        <>
          <button class={`pill${sel === 'all' ? ' on' : ''}`} onClick={() => setSelected('all')}>
            All Sets
          </button>
          {matchSets.map((s) => (
            <button
              key={s.id}
              class={`pill${sel === s.setNumber ? ' on' : ''}`}
              onClick={() => setSelected(s.setNumber)}
            >
              Set {s.setNumber}
            </button>
          ))}
        </>
      }
    >
      {match.done ? (
        <div class="card form">
          <h2>Match finished</h2>
          <div class="note">
            This match is marked Final{record ? ` (${record} in sets)` : ''}. Tap buttons are off.
          </div>
          <button class="ghost" onClick={() => reopenMatch(match.id)}>
            Reopen match
          </button>
        </div>
      ) : null}

      <SummaryCard s={stats} />

      <Band colour="sky" title="Serve Receive (0–3)" info={`In-Sys: ${formatPercent(stats.pass.inSystemPct)} (3s+2s)`}>
        <Keys keys={PASS_KEYS} cols={4} {...band} />
      </Band>
      <Band colour="green" title="Attacking / Hitting" info={`${stats.hit.kill} Kills (${stats.hit.attempts} Att)`}>
        <Keys keys={HIT_KEYS} cols={3} {...band} />
      </Band>
      <Band colour="amber" title="Serving" info={`${stats.serve.total} Serves • ${stats.serve.ace} Aces`}>
        <Keys keys={SERVE_KEYS} cols={3} {...band} />
      </Band>

      <div class="card">
        <div class="bhead">
          <div class="bt">
            <span class="dot" style="background:var(--ink)" />
            Score
          </div>
          <div class="bi">Set {target.setNumber}</div>
        </div>
        <div class="score">
          {(['us', 'them'] as const).map((side) => {
            const label = side === 'us' ? 'Us' : 'Them';
            const value = (side === 'us' ? target.scoreUs : target.scoreThem) ?? 0;
            return (
              <div class="side" key={side}>
                <div class="sl">{label}</div>
                <div class="sctl">
                  <button
                    class="sm"
                    disabled={!live}
                    aria-label={`Remove a point for ${label}`}
                    onClick={() => adjustScore(target.id, side, -1)}
                  >
                    −
                  </button>
                  <div class="sv" style={`color:${side === 'us' ? 'var(--sky)' : 'var(--ink)'}`}>
                    {value}
                  </div>
                  <button
                    class={`sp ${side === 'us' ? 'g-green' : 'g-gray'}`}
                    disabled={!live}
                    aria-label={`Add a point for ${label}`}
                    onClick={() => adjustScore(target.id, side, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {live && (sel === 'all' || sel === latest.setNumber) ? (
        <button class="endset" onClick={() => setSheetOpen(true)}>
          End Set {latest.setNumber}
        </button>
      ) : null}

      <div class="card">
        <button
          class={`hhead${historyOpen ? ' open' : ''}`}
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <h2>
            <span class="ch">
              <Icon d={ICON.chev} size={18} />
            </span>
            Action history
          </h2>
          <div class="bi">
            {historyOpen || !last ? `${events.length} touches` : `Last: ${describeEvent(last)}`}
          </div>
        </button>
        {historyOpen ? (
          <div class="hbody">
            {history.length ? (
              history.slice(0, 10).map((e) => (
                <div class="hrow" key={e.id}>
                  <span class="ht">
                    {new Date(e.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span class={`hb g-${colourOf(e.kind, e.value)}`}>{describeEvent(e)}</span>
                  <span class="hs">Set {matchSets.find((s) => s.id === e.setId)?.setNumber}</span>
                  {live ? (
                    <button class="hx" aria-label="Remove this touch" onClick={() => undo(e)}>
                      <Icon d={ICON.x} size={16} />
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <div class="empty">No touches logged yet for this {sel === 'all' ? 'match' : 'set'}.</div>
            )}
            {sel === 'all' && live ? (
              <div class="note" style="margin-top:6px">
                Taps in All Sets are recorded to Set {latest.setNumber}.
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div class="row2">
        <CopyReportButton text={reportText(data.player, match, matchSets, data.events)} />
        <button class="btn2" onClick={() => navigate(paths.matches)}>
          ＋ New match
        </button>
      </div>

      {sheetOpen ? (
        <EndSetSheet
          match={match}
          set={latest}
          onClose={() => {
            setSheetOpen(false);
            setSelected(null);
          }}
        />
      ) : null}
    </Shell>
  );
}
