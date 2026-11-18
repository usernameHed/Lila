// The landing page: what the tool is for, what it shows, what to do about it, and how it was built, in one scroll.
// Everything a reviewer or a level designer needs without opening the repository. Links open the live views.
import type { Index } from '../lib/types';

const REPO = 'https://github.com/usernameHed/Lila';

export const OVERVIEW_SECTIONS: [string, string][] = [
  ['try', 'Try it'],
  ['findings', 'What the data says'],
  ['proposals', 'What to do about it'],
  ['details', 'Data we had to get right'],
  ['build', 'How it is built'],
  ['next', 'What to log next'],
];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Go({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <a className="go" href={to}>
      {children} <span aria-hidden>→</span>
    </a>
  );
}

function Finding({ n, title, img, alt, children, to, cta }: { n: number; title: string; img: string[]; alt: string; children: React.ReactNode; to: string; cta: string }) {
  return (
    <article className="finding">
      <h3>
        <span className="num">{n}</span> {title}
      </h3>
      <div className="finding-body">
        <div className="finding-text">
          {children}
          <Go to={to}>{cta}</Go>
        </div>
        <div className="finding-figs">
          {img.map((src) => (
            <img key={src} src={`/figures/${src}.png`} alt={alt} loading="lazy" decoding="async" />
          ))}
        </div>
      </div>
    </article>
  );
}

export function Overview({ index }: { index: Index | null }) {
  const t = index?.totals;
  return (
    <div className="overview">
      <header className="ov-hero">
        <p className="eyebrow">LILA BLACK · Player journey visualizer</p>
        <h1>See where players move, fight, loot and die, on the map.</h1>
        <p className="lede">
          Level designers had raw telemetry and no way to see it. This tool turns 5 days of production data into replays and
          heatmaps on each minimap, in 2D and 3D, with a link for every view.
        </p>
        <div className="stats">
          <Stat value={index ? String(index.matches.length) : '…'} label="matches" />
          <Stat value={t ? String(t.humans) : '…'} label="players" />
          <Stat value={t ? t.rows.toLocaleString('en') : '…'} label="events" />
          <Stat value="3" label="maps" />
          <Stat value="5" label="days (Feb 10-14)" />
        </div>
      </header>

      <section id="try">
        <h2>Try it</h2>
        <div className="cards">
          <a className="card" href="#mode=replay&map=AmbroseValley">
            <strong>Watch a match</strong>
            <span>Play it at 10-60x, scrub the timeline, see every kill, death and loot. Space plays and pauses.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&match=all">
            <strong>All 566 matches at once</strong>
            <span>Every player on Ambrose Valley on one clock: where everyone is at minute 8.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&under=1&layer=traffic,kills&hide=humanPath,botPath">
            <strong>Kill zones over traffic</strong>
            <span>Heatmaps you can stack (right panel): traffic, loot, kills, deaths, storm deaths, power positions, lines of fire.</span>
          </a>
          <a className="card" href="#mode=replay&map=Lockdown&view=3d&under=1&layer=traffic&match=all">
            <strong>3D, with terrain</strong>
            <span>Height from the data, a terrain estimated from where players walked, the heatmap on the ground.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&match=all&players=once">
            <strong>Players who never came back</strong>
            <span>The 84 Ambrose Valley matches that were a player's only one: where they went, where they died.</span>
          </a>
          <a className="card" href="#mode=replay&map=Lockdown&under=1&layer=traffic,storm&hide=humanPath,botPath">
            <strong>Where the storm catches players</strong>
            <span>Storm deaths over traffic on Lockdown.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&under=1&layer=power,raised&hide=humanPath,botPath">
            <strong>Power positions</strong>
            <span>Spots that win 3-5x more fights per minute, and kills made from rooftops and ledges.</span>
          </a>
          <a className="card" href="#mode=replay&map=AmbroseValley&end=player&match=all">
            <strong>The only player vs player fights</strong>
            <span>3 matches. Each time: a kill and a death at the same second and spot, and the other player is not in the data at all (searched).</span>
          </a>
          <a className="card" href="#mode=data">
            <strong>Your own data</strong>
            <span>Drop another LILA BLACK export (a zip, a folder): it is processed in your browser and the whole tool runs on it.</span>
          </a>
          <a className="card" href="#mode=replay&map=Lockdown&match=ead4c72d-0e3b-49b4-a91b-a9a21bed8012">
            <strong>Click a player</strong>
            <span>In any replay, click a path: its whole story, fights and events, past and future path.</span>
          </a>
        </div>
        <p className="hint-line">Tips: click a row to show it alone, tick its box to add it · hover the legend to spot a kind on the map · every view is a link you can share.</p>
      </section>

      <section id="findings">
        <h2>What the data says</h2>
        <Finding n={1} title="New players stop after one match, and most of them died to a bot" img={['players', 'return']} alt="Players by matches played; next-day return" to="#mode=replay&map=AmbroseValley&match=all&players=once" cta="See their matches">
          <p>
            <b>43%</b> of players (107 of 248) played a single match. That match ended in a death to a bot <b>61.7%</b> of the
            time, against 48.5% for players who came back. Only <b>6-18%</b> of each day's new players returned the next day.
          </p>
        </Finding>
        <Finding n={2} title="Bots make every fight" img={['combat']} alt="Who players kill, what kills players" to="#mode=replay&map=AmbroseValley&under=1&layer=deaths&deaths=bots&hide=humanPath,botPath" cta="Where bots kill players">
          <p>
            Players killed <b>2,240 bots and 3 players</b>. <b>91%</b> of player deaths are to bots. 794 of 796 matches carry one
            human: in practice, the game is PvE.
          </p>
        </Finding>
        <Finding n={3} title="The storm is a clock, and it takes the fullest bags" img={['storm_timing', 'storm_map']} alt="Deaths by minute; storm deaths on the maps" to="#mode=replay&map=Lockdown&under=1&layer=traffic,storm&hide=humanPath,botPath" cta="Storm deaths on Lockdown">
          <p>
            No storm death before minute <b>10.9</b>; <b>28%</b> of 11+ minute runs end in one. Victims carried a median 18 items
            (bot deaths: 8) and died mid-map: they did not reach extraction in time.
          </p>
        </Finding>
        <Finding n={4} title="Ambrose Valley's center is a death trap that pays no better than the south" img={['ambrose_heat', 'ambrose_regions']} alt="Kills and loot; regions" to="#mode=replay&map=AmbroseValley&under=1&layer=loot,kills&hide=humanPath,botPath" cta="Kills over loot">
          <p>
            The center holds <b>53.5%</b> of deaths for 35% of the time spent. The south-center gives more loot per minute at a
            <b> quarter</b> of the death rate: the safest route is also the best one.
          </p>
        </Finding>
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

      <section id="details">
        <h2>Data we had to get right</h2>
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
      </section>

      <section id="build">
        <h2>How it is built</h2>
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
      </section>

      <section id="next">
        <h2>What to log next</h2>
        <p>Today a kill holds only the killer's position and the time: <b>no victim, no aim</b>. With these, the tool answers much more:</p>
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

      <footer className="ov-footer">
        Built by Ugo Belfiore with Claude, for LILA Games. Source, pipeline and docs:{' '}
        <a href={REPO} target="_blank" rel="noreferrer">github.com/usernameHed/Lila</a>
      </footer>
    </div>
  );
}
