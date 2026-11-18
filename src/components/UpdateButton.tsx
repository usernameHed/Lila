import { applyUpdate, useUpdateReady } from '../lib/update';

/** The green Update pill of Ugo's dashboard: shows only when a newer version is live. */
export function UpdateButton() {
  if (!useUpdateReady()) return null;
  return (
    <button className="update-btn" onClick={applyUpdate} title="A new version is ready" aria-label="Update to the new version">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
      </svg>
      <span>Update</span>
    </button>
  );
}
