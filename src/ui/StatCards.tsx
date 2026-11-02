import {
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
    </>
  );
}
