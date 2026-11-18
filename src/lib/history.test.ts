import { describe, expect, it } from 'vitest';
import { record, redo, start, undo } from './history';

describe('undo / redo', () => {
  it('steps back and forth', () => {
    let h = start(1);
    h = record(h, 2, 'a', 0);
    h = record(h, 3, 'b', 5000);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h); // nothing left
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
  });

  it('merges quick changes of the same setting into one step', () => {
    let h = start(0);
    h = record(h, 1, 'slider', 0);
    h = record(h, 2, 'slider', 100);
    h = record(h, 3, 'slider', 200);
    expect(undo(h).present).toBe(0);
  });

  it('a new change clears what could be redone', () => {
    let h = record(start(0), 1, 'a', 0);
    h = undo(h);
    h = record(h, 5, 'b', 5000);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe(5);
  });
});
