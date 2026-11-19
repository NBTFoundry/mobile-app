import { busy, serialized } from '../src/car/queue';

function gate() {
  let open!: () => void;
  const opened = new Promise<void>(resolve => { open = resolve; });
  return { open, opened };
}

describe('car action queue', () => {
  it('runs actions one at a time, in order', async () => {
    const order: string[] = [];
    const first = gate();
    const a = serialized(async () => { order.push('a start'); await first.opened; order.push('a end'); });
    const b = serialized(async () => { order.push('b'); });
    expect(busy()).toBe(true);
    await Promise.resolve();
    expect(order).toEqual(['a start']);
    first.open();
    await Promise.all([a, b]);
    expect(order).toEqual(['a start', 'a end', 'b']);
    expect(busy()).toBe(false);
  });

  it('keeps going after a failed action', async () => {
    const failed = serialized(async () => { throw new Error('x'); });
    await expect(failed).rejects.toThrow('x');
    await expect(serialized(async () => 'next')).resolves.toBe('next');
    expect(busy()).toBe(false);
  });

  it('a pairing makes the actions queued before it stop, and runs', async () => {
    const running = gate();
    const wanted: Record<string, boolean> = {};
    const a = serialized(async turn => { await running.opened; wanted.a = turn.stillWanted(); });
    const b = serialized(async turn => { wanted.b = turn.stillWanted(); });
    const pair = serialized(async turn => { wanted.pair = turn.stillWanted(); }, true);
    const c = serialized(async turn => { wanted.c = turn.stillWanted(); });
    running.open();
    await Promise.all([a, b, pair, c]);
    expect(wanted).toEqual({ a: false, b: false, pair: true, c: true });
  });
});
