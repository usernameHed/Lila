/** A row of mutually exclusive buttons (bots / players / both, 2D / 3D, ...). `big`: the On / Off of a panel. */
export function Choice<T extends string>({ label, options, value, onChange, big }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void; big?: boolean }) {
  return (
    <div className={`choice ${big ? 'big' : ''}`} role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  );
}
