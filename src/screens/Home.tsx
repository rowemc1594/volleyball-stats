import { useState } from 'preact/hooks';
import type { AppData } from '../db/repo';
import { savePlayer, startMatch } from '../db/repo';
import { activeMatch, dateParts, setRecord, setsOf, shortDate, todayLocal } from '../domain';
import { showToast } from '../hooks';
import { dismissInstallHint, readInstallContext, shouldShowInstallHint } from '../installHint';
import { navigate, paths } from '../router';
import { eventsForMatch, formatAverage, formatHitting, summarize } from '../stats/engine';
import { Icon, ICON, Shell, Tabs } from '../ui/Shell';
import { PassDistribution, StatsCells, StatsHead, SummaryCard } from '../ui/StatCards';

function StartMatchForm() {
  const [opponent, setOpponent] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [event, setEvent] = useState('');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!opponent.trim()) return;
    const id = await startMatch({ opponent, matchDate: date || todayLocal(), event });
    navigate(paths.track(id));
  };

  return (
    <form class="card form" onSubmit={submit}>
      <h2>Start a match</h2>
      <div class="field">
        <label for="nmOpp">Opponent</label>
        <input
          id="nmOpp"
          required
          placeholder="e.g. Ridgeline"
          autocomplete="off"
          value={opponent}
          onInput={(e) => setOpponent(e.currentTarget.value)}
        />
      </div>
      <div class="row">
        <div class="field">
          <label for="nmDate">Date</label>
          <input id="nmDate" type="date" value={date} onInput={(e) => setDate(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="nmEvent">Event (optional)</label>
          <input
            id="nmEvent"
            placeholder="League, tourney…"
            autocomplete="off"
            value={event}
            onInput={(e) => setEvent(e.currentTarget.value)}
          />
        </div>
      </div>
      <button class="big g-green" type="submit">
        Start match →
      </button>
    </form>
  );
}

function PlayerForm({ data }: { data: AppData }) {
  const [name, setName] = useState(data.player?.name ?? '');
  const [jersey, setJersey] = useState(data.player?.jersey ?? '');

  const submit = async (e: Event) => {
    e.preventDefault();
    await savePlayer(name, jersey);
    showToast('Player saved');
  };

  return (
    <form class="card form" onSubmit={submit}>
      <h2>Player</h2>
      <div class="row">
        <div class="field" style="flex:2">
          <label for="pName">Name</label>
          <input
            id="pName"
            placeholder="Son"
            autocomplete="off"
            value={name}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <label for="pNum">Jersey #</label>
          <input
            id="pNum"
            inputMode="numeric"
            value={jersey}
            onInput={(e) => setJersey(e.currentTarget.value)}
          />
        </div>
      </div>
      <button class="ghost" type="submit">
        Save player
      </button>
    </form>
  );
}

function MatchList({ data }: { data: AppData }) {
  const active = activeMatch(data.matches);
  return (
    <div class="card">
      <h2>Matches</h2>
      {data.matches.length === 0 ? (
        <div class="empty">No matches yet. Start your first match above.</div>
      ) : (
        data.matches.map((m) => {
          const ms = setsOf(data.sets, m.id);
          const s = summarize(eventsForMatch(data.events, m.id));
          const rec = setRecord(ms).label;
          const dp = dateParts(m.matchDate);
          return (
            <div class="mrow" key={m.id}>
              <button class="mmain" onClick={() => navigate(paths.track(m.id))}>
                <div class="d">
                  {dp.month}
                  <b>{dp.day}</b>
                </div>
                <div class="mt">
                  <div>vs {m.opponent}</div>
                  <div>
                    {rec ? `${rec} · ` : ''}
                    {ms.length} set{ms.length === 1 ? '' : 's'} · P {formatAverage(s.pass.average)} · H{' '}
                    {formatHitting(s.hit.hittingPct)} · {s.serve.ace} ace{s.serve.ace === 1 ? '' : 's'}
                  </div>
                </div>
                {m.done ? (
                  <span class="tag" style="background:#2A3550;color:#C6D0E4">
                    Final
                  </span>
                ) : m.id === active?.id ? (
                  <span class="tag">Active</span>
                ) : null}
              </button>
              <button class="hbtn" aria-label="Match details" onClick={() => navigate(paths.match(m.id))}>
                <Icon d={ICON.list} />
              </button>
            </div>
          );
        })
      )}
      {data.matches.length ? (
        <div class="note" style="margin-top:8px">
          Tap a match to track it. The list icon opens its details.
        </div>
      ) : null}
    </div>
  );
}

function InstallHint() {
  const [show, setShow] = useState(() => shouldShowInstallHint(readInstallContext()));
  if (!show) return null;
  return (
    <div class="card hint" role="note">
      <b>Install this app on your iPhone</b>
      <ol>
        <li>
          Tap the <b>Share</b> button (square with an arrow) in Safari.
        </li>
        <li>
          Choose <b>Add to Home Screen</b>, then <b>Add</b>.
        </li>
        <li>Open it from the new icon. It works offline, and Safari will not clear your stats.</li>
      </ol>
      <button
        class="ghost"
        onClick={() => {
          dismissInstallHint();
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}

export function MatchesScreen({ data }: { data: AppData }) {
  const active = activeMatch(data.matches);
  return (
    <Shell title={`${data.player?.name || 'Son'}’s Stats`} sub="Courtside stats" tabs={<Tabs tab="matches" />}>
      <InstallHint />
      {active ? (
        <button class="big g-blue resume" onClick={() => navigate(paths.track(active.id))}>
          <span>Resume match</span>
          <b>
            vs {active.opponent} · Set {setsOf(data.sets, active.id).length}
          </b>
        </button>
      ) : null}
      <StartMatchForm />
      <MatchList data={data} />
      <PlayerForm key={data.player?.id ?? 'none'} data={data} />
    </Shell>
  );
}

export function SeasonScreen({ data }: { data: AppData }) {
  const name = data.player?.name || 'Son';
  const label = name + (data.player?.jersey ? ` #${data.player.jersey}` : '');
  const season = summarize(data.events);
  const n = data.matches.length;
  return (
    <Shell title={`${name}’s Stats`} sub="Courtside stats" tabs={<Tabs tab="season" />}>
      <div>
        <h1>{label}</h1>
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
                    <tr class="click" key={m.id} onClick={() => navigate(paths.match(m.id))}>
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
      <div class="card">
        <h2>How to read these</h2>
        <p class="note" style="margin:0">
          <b>Pass avg</b> is serve receive on a 0–3 scale: 3 means the setter can run any play, 2 gives two
          options, 1 means out of system (high or off the net), 0 is a shank or an ace against. 2.0 or higher
          is solid. <b>In-sys</b> counts 3s and 2s.
          <br />
          <b>Hit %</b> = (kills − errors) ÷ attempts. Around .200 is good at this age; .300+ is excellent.
          <br />
          <b>Serve in %</b> = (aces + in) ÷ serves.
        </p>
      </div>
    </Shell>
  );
}
