// The landing page: why the tool is built the way it is, a few preset views to try, what the data says in one line,
// what to do about it, what to log next, and the build notes. Links open the live views.
import { InstallButton } from './InstallOffer';
import type { Index } from '../lib/types';

const REPO = 'https://github.com/usernameHed/Lila';

export const OVERVIEW_SECTIONS: [string, string][] = [
  ['try', 'Try it'],
  ['findings', 'What the data says'],
  ['proposals', 'What to do about it'],
  ['next', 'What to log next'],
  ['notes', 'Notes on the structure'],
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function Overview({ index }: { index: Index | null }) {
  const t = index?.totals;
  return (
    <div className="overview">
      <p className="ov-note">
        I chose to make this a tool that is easy to use in the browser, hosted on my own website for now, rather than an
        artifact: it lets me manage the code and the data better.
      </p>

      <header className="ov-hero">
        <p className="eyebrow">LILA BLACK · Player journey visualizer</p>
        <h1>See where players move, fight, loot and die, on the map.</h1>
        <div className="stats">
          <Stat value={index ? String(index.matches.length) : '…'} label="matches" />
          <Stat value={t ? String(t.humans) : '…'} label="players" />
          <Stat value={t ? t.rows.toLocaleString('en') : '…'} label="events" />
          <Stat value="3" label="maps" />
          <Stat value="5" label="days (Feb 10-14)" />
        </div>
        <p className="lede">
          <b>TL;DR:</b> I built this tool to be usable straight away, in the simplest way possible. For that, people usually
          forget the basics, the things that make a tool robust and usable:
        </p>
        <ul className="basics-list">
          <li>
            Runs in the browser, and installs as a Chromium web app (a real app later, if needed). <InstallButton />
          </li>
          <li>Works offline as much as possible after the first load.</li>
          <li>
            Takes new data with a simple <a href="#mode=data">drag and drop</a>.
          </li>
          <li>Undo and redo for data, selection and settings: very important, and often forgotten.</li>
          <li>Optimistic UI while things load in the background.</li>
          <li>Responsive UI, on a phone as on a PC.</li>
        </ul>
      </header>

      <section id="try">
        <h2>Try it</h2>
        <p>Here are 4 examples of preset settings for the data currently loaded:</p>
        <div className="cards">
          <a className="card" href="#mode=replay&map=AmbroseValley">
            <strong>Watch a match</strong>
            <span>Play, scrub, see every kill, death and loot.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&match=all">
            <strong>All 566 matches at once</strong>
            <span>Every player on one clock.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&under=1&layer=traffic,kills&hide=humanPath,botPath">
            <strong>Kill zones over traffic</strong>
            <span>Stacked heatmaps, right panel.</span>
          </a>
          <a className="card" href="#mode=replay&map=Lockdown&view=3d&under=1&layer=traffic&match=all">
            <strong>3D, with terrain</strong>
            <span>Real heights, estimated ground.</span>
          </a>
        </div>
      </section>

      <section id="findings">
        <h2>What the data says</h2>
        <p>
          43% of players played a single match, and most of them died to a bot in it; bots cause 91% of player deaths; the
          storm only kills after minute 10.9 and takes the fullest bags; Ambrose Valley's center holds half the deaths for
          no better loot than the south. Details and charts in <a href={`${REPO}/blob/main/INSIGHTS.md`} target="_blank" rel="noreferrer">INSIGHTS.md</a>.
        </p>
      </section>

      <section id="proposals">
        <h2>What to do about it</h2>
        <table className="ov-table">
          <thead>
            <tr><th>#</th><th>Proposal</th><th>Test</th><th>Metrics that should move</th></tr>
          </thead>
          <tbody>
            <tr><td>1</td><td><b>First-match bots</b>: fewer or softer bots near spawn for a player's first 3 matches; extraction shown from minute 0</td><td>A/B on new players</td><td>First-match survival, matches per player, next-day return</td></tr>
            <tr><td>2</td><td><b>Extraction before the storm</b>: an "extract now" cue at minute 10; extraction points reachable from where victims stood</td><td>Before / after</td><td>Storm deaths per match, extraction rate of 10+ minute runs</td></tr>
            <tr><td>3</td><td><b>Make risk pay</b> on Ambrose Valley: more valuable loot in the center, or bot pressure moved south</td><td>Before / after</td><td>Loot and deaths per minute by region</td></tr>
            <tr><td>4</td><td><b>Decide what matchmaking is for</b>: more humans per match so PvP spaces live, or design the maps for PvE</td><td>Product decision</td><td>PvP encounters per match, queue time</td></tr>
          </tbody>
        </table>
        <p className="muted small">A 5-day, partial sample: these are correlations to test, not proof.</p>
      </section>

      <section id="next">
        <h2>What to log next</h2>
        <p>
          For a more useful tool, we would need a few more data points. They could easily be added to the game code with a
          few prompts in Claude, and would help more than the current data. Today a kill holds only the killer's position
          and the time: <b>no victim, no aim</b>.
        </p>
        <ul className="checks">
          <li><b>Kills and deaths</b>: the other side's id and position, weapon, distance, line of sight → a line of fire for every fight.</li>
          <li><b>Facing</b> on position samples, 1-2 s sampling in combat → sightlines.</li>
          <li><b>Storm zone</b>: its edge or radius every few seconds. <b>Needed next time</b>: today only its victims are logged, so the moving storm cannot be shown (the timeline marks when it starts killing, minute 10.9).</li>
          <li><b>Extraction</b> events → a real extraction rate (today "survived" = no death logged).</li>
          <li><b>Match start</b> (humans and bots in the match, spawn point) and <b>wall-clock time</b> → matchmaking and first-match analysis.</li>
          <li><b>Level geometry</b> (collision mesh or navmesh export) → real line of sight with walls and cover, and whether each power position can be reached from several routes.</li>
          <li><b>Loot value</b>, every bot logged, test accounts flagged.</li>
        </ul>
      </section>

      <section id="notes">
        <h2>Notes from my Claude agent on the structure</h2>
        <details className="ov-more">
          <summary>Data we had to get right</summary>
          <ul className="checks">
            <li><b>Coordinates.</b> <code>u = (x − originX) / scale</code>, <code>v = (z − originZ) / scale</code>, image y flipped; <code>y</code> is height. Checked three ways: the README's worked example (pixel 78, 890) as a test, all 89,104 rows inside their map, paths on roads. The minimaps are 4320, 2160 and 9000 px, not 1024: mapping in UV makes it harmless.</li>
            <li><b>Timestamps are seconds, typed as milliseconds.</b> Read as ms, matches last under 1 s; as seconds, 13 s to 15 min.</li>
            <li><b>Bots by movement, not by id.</b> 17 files with numeric (bot-style) ids move and loot like humans (mostly user 1429): classified as humans.</li>
            <li><b>Same event, two meanings.</b> A human's <code>BotKill</code> is "I killed a bot", a bot's is "this bot killed someone": stored by meaning.</li>
            <li><b>One journey exported twice</b> (a match across midnight, Feb 10 and 11): read once.</li>
            <li><b>Event bytes decoded</b>, no file unreadable, no match on two maps.</li>
            <li><b>Killer → victim pairs</b>: 36 where both events are recorded (same second, within 60 m), plus 6 inferred from a bot path that stops at the kill or a bot within 40 m of a death (drawn lighter). 95% of fights happen in matches with no bot recorded: there, the data has no victim at all.</li>
            <li><b>No storm position in the data</b>: the moving storm cannot be drawn (inferring it was tested and rejected). The timeline shows when it kills: only after minute 10.9.</li>
            <li><b>Player vs player is 3 events.</b> In all 3, the only human recorded has a Kill and a Killed at the same second and the same spot, at the end of the match: a trade or a self-kill; the other player's file is missing. Kept visible on their own (filter "Fought a player").</li>
            <li><b>The terrain is an estimate.</b> Ground height per 9 m cell comes from where players and bots walked (the low end of the heights seen there); walls and buildings are not in the data.</li>
          </ul>
        </details>
        <details className="ov-more">
          <summary>How it is built</summary>
          <div className="flow">
            <span>1,243 parquet files</span>
            <span>Python pipeline (pyarrow), once</span>
            <span>Small static JSON + 2048 px minimaps</span>
            <span>React + canvas (2D), three.js on demand (3D)</span>
            <span>Cloudflare, deployed on every push</span>
            <span>New data: the same pipeline in the browser</span>
          </div>
          <table className="ov-table">
            <thead>
              <tr><th>Considered</th><th>Chosen</th><th>Why</th></tr>
            </thead>
            <tbody>
              <tr><td>Parse parquet in the browser</td><td>Offline pipeline to JSON</td><td>A 5 KB file per match instead of a database engine in the page; the data never changes</td></tr>
              <tr><td>Streamlit / a server</td><td>Static site</td><td>Opens instantly, nothing to keep running, finer UX control</td></tr>
              <tr><td>One request per match</td><td>Map-day bundles above 5 matches</td><td>566 matches = 5 requests, replayed at 60 fps</td></tr>
              <tr><td>Gradient heatmaps</td><td>Toon bands, one color per kind</td><td>Read like contour lines; kinds stack and stay apart</td></tr>
              <tr><td>3D only, or always loaded</td><td>2D first, 3D on demand</td><td>Designers read top-down maps first; 3D answers "which floor"</td></tr>
            </tbody>
          </table>
        </details>
      </section>

      <footer className="ov-footer">
        Built by Ugo Belfiore with Claude, for LILA Games. Source, pipeline and docs:{' '}
        <a href={REPO} target="_blank" rel="noreferrer">github.com/usernameHed/Lila</a>
      </footer>
    </div>
  );
}
