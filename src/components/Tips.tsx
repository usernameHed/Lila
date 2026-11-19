import { useEffect, useState } from 'react';

/**
 * Instant tooltips for any element with a `data-tip` attribute (the browser's own `title` tooltips are slow and do
 * not always show, e.g. in the installed app). One listener for the whole page; the tip opens beside the element,
 * on the side with more room, in the same style as the layer rows' explanations.
 */
export function Tips() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  useEffect(() => {
    const over = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-tip]') as HTMLElement | null;
      const text = el?.dataset.tip;
      setTip(el && text ? { text, rect: el.getBoundingClientRect() } : null);
    };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', over);
    document.addEventListener('scroll', hide, true);
    document.addEventListener('pointerdown', hide);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('scroll', hide, true);
      document.removeEventListener('pointerdown', hide);
    };
  }, []);
  if (!tip) return null;
  const right = tip.rect.right + 300 < window.innerWidth;
  const style = right
    ? { left: tip.rect.right + 10, top: tip.rect.top + tip.rect.height / 2 }
    : { right: window.innerWidth - tip.rect.left + 10, top: tip.rect.top + tip.rect.height / 2 };
  return (
    <div className="row-tip" role="tooltip" style={style}>
      {tip.text}
    </div>
  );
}
