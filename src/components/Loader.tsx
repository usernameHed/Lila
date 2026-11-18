// The loading screen: the tool's name and a sliding bar, the same as the one in index.html shown before the app
// starts, so the page never sits black while files arrive.
export function Loader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="loader-mark">LILA BLACK</div>
      <div className="loader-bar">
        <span />
      </div>
      <div className="loader-label">{label}</div>
    </div>
  );
}
