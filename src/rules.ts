/*
 * The "Know the rules" dictionary. Plain English for parents, in standard indoor volleyball terms.
 * Leagues and age levels differ in the details, so the page tells readers their league's rules win.
 */

export interface RuleEntry {
  id: string;
  term: string;
  topic: string;
  /** One plain sentence. Always shown. */
  short: string;
  /** What you will actually see on the court. Shown when the entry is opened. */
  see?: string;
  /** Other words people use for it, so search finds "carry" or "net touch". */
  aliases?: string[];
}

export const TOPICS = [
  'Ball contacts',
  'Net and center line',
  'Rotation and lineup',
  'Serving',
  'Scoring',
  'Plays and terms',
  'Stats in this app',
] as const;

export const RULES: RuleEntry[] = [
  // Ball contacts
  {
    id: 'double-hit',
    term: 'Double hit',
    topic: 'Ball contacts',
    short: 'The same player hits the ball twice in a row.',
    see: 'The official raises two fingers. It is allowed on a block, and on a team’s first contact when it is one smooth play, like digging a hard-driven ball. Most double hits are called on sets.',
    aliases: ['double contact', 'two hits', 'doubles'],
  },
  {
    id: 'lift',
    term: 'Lift (carry)',
    topic: 'Ball contacts',
    short: 'The ball is caught, held or scooped instead of cleanly bouncing off the hands or arms.',
    see: 'The official makes a scooping motion with an open hand. A set that stays in the hands too long is the usual cause.',
    aliases: ['carry', 'held ball', 'catch', 'scoop', 'palming'],
  },
  {
    id: 'thrown-ball',
    term: 'Thrown ball',
    topic: 'Ball contacts',
    short: 'The ball is thrown or pushed along the hands instead of being hit.',
    see: 'Usually the same signal as a lift. Both are called ball-handling errors.',
    aliases: ['ball handling error', 'ball-handling error', 'throw'],
  },
  {
    id: 'four-hits',
    term: 'Four hits',
    topic: 'Ball contacts',
    short: 'A team touches the ball more than three times before sending it over the net.',
    see: 'A team gets three contacts: usually pass, set, hit. A block touch does not count as one of the three.',
    aliases: ['three touches', 'too many hits', 'four contacts'],
  },

  // Net and center line
  {
    id: 'net-touch',
    term: 'Net touch',
    topic: 'Net and center line',
    short: 'A player touches the net while the ball is in play.',
    see: 'The official points to the net. In many leagues only touches that affect the play count. In others, any net touch by a player during play is a fault. Brushing the net after the rally has ended is not a fault.',
    aliases: ['touching the net', 'net violation', 'net', 'netted'],
  },
  {
    id: 'under-net',
    term: 'Under the net (center line)',
    topic: 'Net and center line',
    short: 'A player steps under the net or across the center line into the other team’s court.',
    see: 'Part of one foot may touch the center line. Going fully over it, or into the other court in a way that bothers the other team, is a fault. In this app, stepping under on a block is the Err → Under choice.',
    aliases: ['center line', 'centerline', 'crossing the line', 'under', 'stepping under', 'under the net'],
  },
  {
    id: 'reaching-over',
    term: 'Reaching over the net',
    topic: 'Net and center line',
    short: 'Reaching across the net to play the ball before the other team has hit it.',
    see: 'A blocker may reach over once the attacker has hit the ball. Reaching over to hit a ball that is still on the other side before then is a fault.',
    aliases: ['reach over', 'over the net', 'blocking over'],
  },
  {
    id: 'back-row-attack',
    term: 'Back-row attack',
    topic: 'Net and center line',
    short: 'A back-row player jumps from in front of the attack line and hits the ball that is above the net.',
    see: 'Back-row players may attack, but they must take off from behind the attack line (the 10-foot or 3-meter line). Back-row players may not block either.',
    aliases: ['back row', 'attack line', '10 foot line', 'three meter line', 'back row block'],
  },

  // Rotation and lineup
  {
    id: 'rotation',
    term: 'Rotation',
    topic: 'Rotation and lineup',
    short: 'When your team wins the serve back, all six players move one spot clockwise.',
    see: 'The player moving into the right-back spot becomes the server. Everyone keeps this order for the whole set.',
    aliases: ['rotate', 'rotating'],
  },
  {
    id: 'rotation-error',
    term: 'Rotation error (out of rotation)',
    topic: 'Rotation and lineup',
    short: 'The wrong player serves, or the team rotated in the wrong order.',
    see: 'Once it is noticed, points won while out of order are usually cancelled and the other team gets the serve.',
    aliases: ['out of rotation', 'serving out of order', 'wrong server', 'rotation fault'],
  },
  {
    id: 'overlap',
    term: 'Overlap',
    topic: 'Rotation and lineup',
    short: 'When the ball is served, a player is standing out of place compared with the players next to them.',
    see: 'Each front-row player must be in front of the back-row player behind them. Players on the left and right must also stay in order. Once the ball is served, players may move anywhere.',
    aliases: ['position fault', 'positional fault', 'lineup fault', 'out of position'],
  },
  {
    id: 'libero',
    term: 'Libero',
    topic: 'Rotation and lineup',
    short: 'A back-row specialist in a different color jersey who plays defense and passing.',
    see: 'The libero cannot attack the ball above the net, block, or rotate to the front row. Rules on who may serve for the libero vary by league.',
    aliases: ['libero player', 'defensive specialist', 'ds'],
  },

  // Serving
  {
    id: 'foot-fault',
    term: 'Foot fault',
    topic: 'Serving',
    short: 'The server steps on or over the end line before hitting the ball.',
    see: 'The server must contact the ball from behind the end line. The other team gets the point. In this app it is recorded as a serve Fault.',
    aliases: ['foot fault serve', 'stepping on the line', 'end line'],
  },
  {
    id: 'service-error',
    term: 'Service error',
    topic: 'Serving',
    short: 'A serve that does not count: it goes out, hits the antenna, does not cross the net, or breaks a serving rule.',
    see: 'The other team scores a point and serves next. In this app it is the Fault button.',
    aliases: ['serve error', 'fault', 'missed serve', 'service fault'],
  },
  {
    id: 'let-serve',
    term: 'Let serve',
    topic: 'Serving',
    short: 'A serve that touches the net and still goes over.',
    see: 'In most leagues today it is a good serve and the rally continues. Ask your league if you see a different call.',
    aliases: ['net serve', 'serve hits net', 'touches the net on serve'],
  },
  {
    id: 'serve-time',
    term: 'Serve time limit',
    topic: 'Serving',
    short: 'The server must serve soon after the official signals, usually within 8 seconds.',
    aliases: ['8 seconds', 'eight seconds', 'delay of serve', 'slow serve'],
  },

  // Scoring
  {
    id: 'rally-scoring',
    term: 'Rally scoring',
    topic: 'Scoring',
    short: 'Every rally ends with a point for someone, no matter who served.',
    see: 'Sets are usually played to 25 and must be won by 2 points. A deciding third or fifth set is often to 15. Younger or recreational leagues often use lower scores.',
    aliases: ['point per rally', 'scoring', '25 points', 'win by two', 'win by 2'],
  },
  {
    id: 'side-out',
    term: 'Side out',
    topic: 'Scoring',
    short: 'The receiving team wins the rally, so they get the serve (and rotate).',
    aliases: ['sideout', 'serve change'],
  },
  {
    id: 'set-match',
    term: 'Sets and matches',
    topic: 'Scoring',
    short: 'A match is usually the best of 3 sets (first to win 2) or the best of 5 sets (first to win 3).',
    see: 'The score for each set is tracked separately, and the sets won decide the match.',
    aliases: ['best of three', 'best of 5', 'best of three sets', 'match', 'game'],
  },
  {
    id: 'timeout',
    term: 'Timeout and substitution',
    topic: 'Scoring',
    short: 'Each team gets a limited number of short timeouts and substitutions each set, requested by the coach between rallies.',
    see: 'The number allowed depends on the league.',
    aliases: ['time out', 'sub', 'substitute', 'time-out'],
  },

  // Plays and terms
  {
    id: 'ace',
    term: 'Ace',
    topic: 'Plays and terms',
    short: 'A serve that lands in or touches the receiving team for an immediate point.',
    aliases: ['service ace'],
  },
  {
    id: 'kill',
    term: 'Kill',
    topic: 'Plays and terms',
    short: 'A hit that wins the point right away.',
    aliases: ['spike', 'attack', 'swing', 'hit'],
  },
  {
    id: 'dig',
    term: 'Dig',
    topic: 'Plays and terms',
    short: 'A save of a hard-hit ball, keeping the rally alive.',
    aliases: ['defense', 'save', 'pancake'],
  },
  {
    id: 'block',
    term: 'Block',
    topic: 'Plays and terms',
    short: 'Jumping at the net to stop or redirect the other team’s hit.',
    see: 'It scores a point when the ball is stopped on the hitter’s side. A block touch does not count as one of a team’s three hits.',
    aliases: ['stuff', 'roof', 'blocker'],
  },
  {
    id: 'set',
    term: 'Set',
    topic: 'Plays and terms',
    short: 'The second contact, a soft overhand (or forearm) pass to a hitter. Not the same as a set of the game.',
    aliases: ['setter', 'setting', 'assist', 'overhand', 'second ball'],
  },
  {
    id: 'pass',
    term: 'Pass (serve receive)',
    topic: 'Plays and terms',
    short: 'The first contact after a serve, a forearm bump that aims at the setter.',
    aliases: ['bump', 'receive', 'passing', 'serve receive', 'forearm'],
  },
  {
    id: 'tip',
    term: 'Tip (dump)',
    topic: 'Plays and terms',
    short: 'A soft push of the ball over or around the blockers with the fingertips.',
    aliases: ['dump', 'roll shot', 'off-speed'],
  },

  // Stats in this app
  {
    id: 'stat-pass',
    term: 'Pass 3, 2, 1, 0',
    topic: 'Stats in this app',
    short: '3 = perfect, the setter can run any play. 2 = playable, off the net a bit. 1 = out of system, only a high ball. 0 = error or aced.',
    see: 'Pass average = (1×n1 + 2×n2 + 3×n3) ÷ total passes. 2.0 or more is solid at this level. In-System is the share of 2s and 3s.',
    aliases: ['pass average', 'pass avg', 'in-system', 'oos', 'out of system'],
  },
  {
    id: 'stat-hit',
    term: 'Hit: Kill, Play, Err',
    topic: 'Stats in this app',
    short: 'Kill wins the point. Play keeps the rally going (dug or blocked and kept in). Err is out, in the net, or blocked for a point.',
    see: 'Hit % = (kills − errors) ÷ attempts. Around .200 is good at this age, and .300 or more is excellent.',
    aliases: ['hitting percentage', 'hitting %', 'hit %', 'attack percentage'],
  },
  {
    id: 'stat-serve',
    term: 'Serve: Ace, In, Fault',
    topic: 'Stats in this app',
    short: 'Ace scores a point. In is a good serve, no point. Fault is a missed serve or serving error.',
    see: 'Serve In % = (aces + in) ÷ all serves.',
    aliases: ['serve in', 'serve %', 'serving percentage'],
  },
  {
    id: 'stat-block',
    term: 'Block: Block, Touch, Err',
    topic: 'Stats in this app',
    short: 'Block = blocked down for an immediate point. Touch = any touch with no point, solid or small. Err = a net or under-the-net violation.',
    see: 'Block % = blocks ÷ (blocks + touches). Errors are counted but are not part of the percentage.',
    aliases: ['block percentage', 'block %', 'blocks per set'],
  },
  {
    id: 'stat-setting',
    term: 'Setting 3, 2, 1, 0',
    topic: 'Stats in this app',
    short: '3 = perfect set. 2 = good. 1 = bad, but the hitter can still get it over. 0 = error.',
    see: 'Setting average works like pass average. Good Sets is the share of 2s and 3s.',
    aliases: ['setting average', 'good sets', 'set average'],
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();

/** Every word the reader typed must appear somewhere in the entry (term, text or alias). */
export function filterRules(query: string, rules: readonly RuleEntry[] = RULES): RuleEntry[] {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return [...rules];
  return rules.filter((r) => {
    const hay = norm([r.term, r.short, r.see ?? '', r.topic, ...(r.aliases ?? [])].join(' '));
    return words.every((w) => hay.includes(w));
  });
}

export function rulesByTopic(rules: readonly RuleEntry[]): { topic: string; entries: RuleEntry[] }[] {
  return TOPICS.map((topic) => ({ topic, entries: rules.filter((r) => r.topic === topic) })).filter(
    (g) => g.entries.length > 0,
  );
}
