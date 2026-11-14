import {
  blocksPerSet,
  formatAverage,
  formatHitting,
  formatPercent,
  type StatSummary,
} from '../stats/engine';

export function SummaryCard({ s }: { s: StatSummary }) {
  return (
    <div class="card sum">
      <div>
        <div class="l">Pass Avg</div>
        <div class="v" style="color:var(--sky)">{formatAverage(s.pass.average)}</div>
        <div class="s">{s.pass.total} passes</div>
      </div>
      <div>
        <div class="l">Hit %</div>
        <div class="v" style="color:var(--amber)">{formatHitting(s.hit.hittingPct)}</div>
        <div class="s">
          {s.hit.kill}K / {s.hit.error}E / {s.hit.attempts}TA
        </div>
      </div>
      <div>
        <div class="l">Serve In %</div>
        <div class="v" style="color:var(--amber)">{formatPercent(s.serve.inPct)}</div>
        <div class="s">
          {s.serve.ace} Aces / {s.serve.total} Tot
        </div>
      </div>
      <div>
        <div class="l">Block %</div>
        <div class="v" style="color:var(--violet)">{formatPercent(s.block.blockPct)}</div>
        <div class="s">
          {s.block.block}B / {s.block.touch}T / {s.block.error}E
        </div>
      </div>
      <div>
        <div class="l">Setting Avg</div>
        <div class="v" style="color:var(--teal)">{formatAverage(s.setting.average)}</div>
        <div class="s">{s.setting.total} {s.setting.total === 1 ? 'set' : 'sets'}</div>
      </div>
      <div>
        <div class="l">Good Sets</div>
        <div class="v" style="color:var(--teal)">{formatPercent(s.setting.goodPct)}</div>
        <div class="s">2s and 3s</div>
      </div>
    </div>
  );
}

/** One line per band, with the live readouts that used to sit in each band's header. */
export function ReadoutsCard({ s, setsPlayed }: { s: StatSummary; setsPlayed: number }) {
  const bps = blocksPerSet(s.block.block, setsPlayed);
  const rows: [string, string][] = [
    ['Serve receive', `In-Sys ${formatPercent(s.pass.inSystemPct)}`],
    ['Attacking', `${s.hit.kill} Kills (${s.hit.attempts} Att)`],
    ['Serving', `${s.serve.total} Serves • ${s.serve.ace} Aces`],
    [
      'Blocking',
      `${s.block.block} Blocks • ${s.block.touch} Touches • ${s.block.error} Err` +
        (s.block.errorNet || s.block.errorUnder ? ` (${s.block.errorNet} net, ${s.block.errorUnder} under)` : '') +
        (bps === null ? '' : ` • ${bps.toFixed(1)}/set`),
    ],
    ['Setting', `${s.setting.total} Sets • Good ${formatPercent(s.setting.goodPct)}`],
  ];
  return (
    <div class="card">
      <h2>Readouts</h2>
      {rows.map(([label, value]) => (
        <div class="rd" key={label}>
          <span>{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
}

const PASS_COLOURS = ['var(--red)', 'var(--amber)', '#0A94DA', 'var(--green)'];

export function PassDistribution({ s }: { s: StatSummary }) {
  const { total, counts, inSystemPct } = s.pass;
  if (!total) return null;
  const grades = [3, 2, 1, 0] as const;
  return (
    <div class="card">
      <h2>Pass ratings</h2>
      <div class="dist">
        {grades.map((g) =>
          counts[g] ? (
            <div key={g} style={`flex:${counts[g]};background:${PASS_COLOURS[g]}`}>
              {counts[g]}
            </div>
          ) : null,
        )}
      </div>
      <div class="legend">
        {grades.map((g) => (
          <span key={g}>
            <i style={`background:${PASS_COLOURS[g]}`} />
            {g}s: {counts[g]} ({Math.round((counts[g] / total) * 100)}%)
          </span>
        ))}
        <span>In-sys: {formatPercent(inSystemPct)}</span>
      </div>
    </div>
  );
}

export function StatsHead({ first }: { first: string }) {
  return (
    <tr>
      <th>{first}</th>
      <th>Pass</th>
      <th>Srv in</th>
      <th>Ace</th>
      <th>Hit %</th>
      <th>K-E-TA</th>
      <th>Blk</th>
      <th>Blk %</th>
      <th>Set</th>
    </tr>
  );
}

export function StatsCells({ s }: { s: StatSummary }) {
  return (
    <>
      <td>{formatAverage(s.pass.average)}</td>
      <td>{s.serve.total ? `${s.serve.ace + s.serve.in}/${s.serve.total}` : '–'}</td>
      <td>{s.serve.ace}</td>
      <td>{formatHitting(s.hit.hittingPct)}</td>
      <td>
        {s.hit.kill}-{s.hit.error}-{s.hit.attempts}
      </td>
      <td>{s.block.block}</td>
      <td>{formatPercent(s.block.blockPct)}</td>
      <td>{formatAverage(s.setting.average)}</td>
    </>
  );
}
