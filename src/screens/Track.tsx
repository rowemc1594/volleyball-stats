import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addEvent,
  adjustScore,
  endSet,
  finishMatch,
  reopenMatch,
  undoEvent,
  updateEvent,
  type AppData,
  type StatInput,
  type SetScore,
} from '../db/repo';
import type { Match, SetRow } from '../db/schema';
import { dateParts, describeEvent, newestFirst, reportText, setRecord, setsOf } from '../domain';
import { showToast, useLeaveIfMissing } from '../hooks';
import {
  BLOCK_ERROR_KEYS,
  BLOCK_KEYS,
  colourOf,
  HIT_KEYS,
  PASS_KEYS,
  PICK_GROUPS,
  pickLabel,
  SERVE_KEYS,
  SETTING_KEYS,
  type KeyDef,
} from '../keys';
import { navigate, paths } from '../router';
import { eventsForMatch, eventsForSet, summarize } from '../stats/engine';
import type { StatEvent } from '../stats/types';
import { useWakeLock } from '../wakeLock';
import { Icon, ICON, Shell, SyncChip } from '../ui/Shell';
import { ReadoutsCard, SummaryCard } from '../ui/StatCards';

type Selected = 'all' | number | null; // null follows the latest set

function sameStat(e: StatEvent, k: KeyDef) {
  return e.kind === k.input.kind && e.value === k.input.value;
}

interface BandProps {
  keys: KeyDef[];
  /** Names the group of buttons for screen readers, so "Error" is clear in each band. */
  label: string;
  cols: 2 | 3 | 4;
  events: StatEvent[];
  live: boolean;
  pop: string | null;
  onTap: (k: KeyDef) => void;
  /** An extra button after the keys, for Block Err, which asks "net or under?" first. */
  extra?: preact.ComponentChildren;
}

function Keys({ keys, label, cols, events, live, pop, onTap, extra }: BandProps) {
  return (
    <div class={`keys k${cols}`} role="group" aria-label={label}>
      {keys.map((k) => {
        const id = `${k.input.kind}:${k.input.value}`;
        const count = events.filter((e) => sameStat(e, k)).length;
        const popping = pop?.startsWith(id + '#');
        return (
          <button
            key={id}
            class={`key g-${k.colour}`}
            disabled={!live}
            data-key={id}
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
      {extra}
    </div>
  );
}

function Band({ colour, title, children }: { colour: string; title: string; children: preact.ComponentChildren }) {
  return (
    <div class="card">
      <div class="bhead">
        <div class="bt" style={`color:var(--${colour})`}>
          <span class="dot" style={`background:var(--${colour})`} />
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

/** "Net or under?" Appears after tapping Block Err. Escape, Cancel or a tap outside closes it. */
function BlockErrorSheet({
  band,
  onClose,
}: {
  band: Omit<BandProps, 'keys' | 'label' | 'cols' | 'extra'>;
  onClose: () => void;
}) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
  return (
    <div class="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="card form sheetbox" role="dialog" aria-modal="true" aria-label="Block error type">
        <h2 style="margin:0">Block error</h2>
        <Keys
          keys={BLOCK_ERROR_KEYS}
          label="Block error type"
          cols={2}
          {...band}
          onTap={(k) => {
            band.onTap(k);
            onClose();
          }}
        />
        <button class="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * One sheet for both "edit this action" and "add a missed action". Pick the set (when the match
 * has more than one), then tap what happened. Edit mode also offers Remove.
 */
function ActionSheet({
  title,
  sets,
  setId,
  current,
  onPick,
  onRemove,
  onClose,
}: {
  title: string;
  sets: SetRow[];
  setId: string;
  current?: StatEvent;
  onPick: (input: StatInput, setId: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [chosenSet, setChosenSet] = useState(setId);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
  return (
    <div class="sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="card form sheetbox pick" role="dialog" aria-modal="true" aria-label={title}>
        <h2 style="margin:0">{title}</h2>
        {current ? <div class="note">Now: {describeEvent(current)}. Tap what it should be.</div> : null}
        {sets.length > 1 ? (
          <div class="tabs" role="group" aria-label="Set">
            {sets.map((s) => (
              <button
                key={s.id}
                class={`pill${chosenSet === s.id ? ' on' : ''}`}
                aria-pressed={chosenSet === s.id}
                onClick={() => setChosenSet(s.id)}
              >
                Set {s.setNumber}
              </button>
            ))}
          </div>
        ) : null}
        {PICK_GROUPS.map((g) => (
          <div key={g.title}>
            <div class="bt" style={`color:var(--${g.colour})`}>
              <span class="dot" style={`background:var(--${g.colour})`} />
              {g.title}
            </div>
            <div class="keys pk" role="group" aria-label={g.title}>
              {g.keys.map((k) => {
                const isCurrent = !!current && sameStat(current, k);
                return (
                  <button
                    key={`${k.input.kind}:${k.input.value}`}
                    class={`key g-${k.colour}${isCurrent ? ' cur' : ''}`}
                    aria-pressed={current ? isCurrent : undefined}
                    onClick={() => onPick(k.input, chosenSet)}
                  >
                    <strong>{pickLabel(k)}</strong>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {onRemove ? (
          <button class="ghost danger" onClick={onRemove}>
            Remove this action
          </button>
        ) : null}
        <button class="ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
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
  const box = useRef<HTMLDivElement>(null);

  // A proper dialog: focus moves in, Tab stays inside, Escape closes, and focus goes back after.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    box.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>('input, button:not(:disabled)')];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);
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
      <div class="card form sheetbox" role="dialog" aria-modal="true" aria-label={`End set ${set.setNumber}`} ref={box}>
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
  const [errOpen, setErrOpen] = useState(false);
  const [editing, setEditing] = useState<StatEvent | null>(null);
  const [adding, setAdding] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pop, setPop] = useState<string | null>(null);

  useLeaveIfMissing(!!match);
  useWakeLock(!!match && !match.done);
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
      compact
      title={`${name}’s Stats`}
      sub={`vs ${match.opponent} · ${dp.month} ${dp.day}`}
      right={
        <>
          <SyncChip />
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

      {/* Every tap target comes first and stays big. Totals and history sit below the score. */}
      <Band colour="sky" title="Serve Receive (0–3)">
        <Keys keys={PASS_KEYS} label="Serve receive" cols={4} {...band} />
      </Band>
      <Band colour="green" title="Attacking / Hitting">
        <Keys keys={HIT_KEYS} label="Attacking" cols={3} {...band} />
      </Band>
      <Band colour="amber" title="Serving">
        <Keys keys={SERVE_KEYS} label="Serving" cols={3} {...band} />
      </Band>
      <Band colour="violet" title="Blocking">
        <Keys
          keys={BLOCK_KEYS}
          label="Blocking"
          cols={3}
          {...band}
          extra={
            <button
              class="key g-red"
              disabled={!live}
              data-key="block:error"
              onClick={() => setErrOpen(true)}
            >
              <b>ERR</b>
              <strong>Net / Under</strong>
              <small>Tap to choose</small>
              <em class={`n${pop?.startsWith('block:error') ? ' pop' : ''}`} key={pop?.startsWith('block:error') ? pop : 'block:error'}>
                {stats.block.error}
              </em>
            </button>
          }
        />
      </Band>
      <Band colour="teal" title="Setting (0–3)">
        <Keys keys={SETTING_KEYS} label="Setting" cols={4} {...band} />
      </Band>

      <div class="score">
          {(['us', 'them'] as const).map((side) => {
            const label = side === 'us' ? 'Us' : 'Them';
            const value = (side === 'us' ? target.scoreUs : target.scoreThem) ?? 0;
            return (
              <div class="side" key={side}>
                <div class="sl">
                  {label} · Set {target.setNumber}
                </div>
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

      {live && (sel === 'all' || sel === latest.setNumber) ? (
        <button class="endset" onClick={() => setSheetOpen(true)}>
          End Set {latest.setNumber}
        </button>
      ) : null}

      <SummaryCard s={stats} />
      <ReadoutsCard s={stats} setsPlayed={sel === 'all' ? matchSets.length : 1} />

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
              (showAll ? history : history.slice(0, 25)).map((e) => (
                <div class="hrow" key={e.id}>
                  <button
                    class="hmain"
                    disabled={!live}
                    aria-label={`Edit ${describeEvent(e)}`}
                    onClick={() => setEditing(e)}
                  >
                    <span class="ht">
                      {new Date(e.occurredAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span class={`hb g-${colourOf(e.kind, e.value)}`}>{describeEvent(e)}</span>
                    <span class="hs">Set {matchSets.find((s) => s.id === e.setId)?.setNumber}</span>
                    {live ? <span class="hedit">Edit</span> : null}
                  </button>
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
            {history.length > 25 && !showAll ? (
              <button class="ghost" style="width:100%;margin-top:6px" onClick={() => setShowAll(true)}>
                Show all {history.length} actions
              </button>
            ) : null}
            {live ? (
              <button class="ghost" style="width:100%;margin-top:6px" onClick={() => setAdding(true)}>
                ＋ Add a missed action
              </button>
            ) : null}
            {live ? (
              <div class="note" style="margin-top:6px">
                Tap an action to change it, move it to another set, or remove it.
              </div>
            ) : null}
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

      {errOpen ? <BlockErrorSheet band={band} onClose={() => setErrOpen(false)} /> : null}

      {editing ? (
        <ActionSheet
          title="Edit action"
          sets={matchSets}
          setId={editing.setId}
          current={editing}
          onPick={(input, setId) => {
            updateEvent(editing.id, { input, setId })
              .then((changed) => showToast(changed ? 'Action updated' : 'No change'))
              .catch((err) => {
                console.error(err);
                showToast('Could not update that action');
              });
            setEditing(null);
          }}
          onRemove={() => {
            undo(editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {adding ? (
        <ActionSheet
          title="Add a missed action"
          sets={matchSets}
          setId={target.id}
          onPick={(input, setId) => {
            addEvent(setId, input)
              .then(() => showToast('Action added'))
              .catch((err) => {
                console.error(err);
                showToast('Could not add that action');
              });
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}

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
