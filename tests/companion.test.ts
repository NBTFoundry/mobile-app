// SPDX-License-Identifier: MPL-2.0
import { isValue, parseCompanion, WIDGETS_MAX } from '../src/protocol/companion';

describe('phone page', () => {
  it('reads every widget', () => {
    expect(parseCompanion('COMPANION\toff\n')).toEqual({ on: false });
    const page = 'COMPANION\tready\n7\ntitle\tBoost\ntext\t1.2 bar\nbutton\tgo\tGo\ntoggle\tlog\tLog\t1\n'
      + 'choice\tmode\tMode\tsport\teco,sport\nprogress\tOil\t75\n';
    expect(parseCompanion(page)).toEqual({ on: true, sequence: '7', widgets: [
      { kind: 'title', text: 'Boost' }, { kind: 'text', text: '1.2 bar' },
      { kind: 'button', id: 'go', label: 'Go' }, { kind: 'toggle', id: 'log', label: 'Log', on: true },
      { kind: 'choice', id: 'mode', label: 'Mode', value: 'sport', choices: ['eco', 'sport'] },
      { kind: 'progress', label: 'Oil', percent: 75 },
    ] });
  });

  it('leaves out a malformed widget, not the page', () => {
    const bad = ['title', 'title\t', 'title\ta\tb', 'button\tGo\tGo', 'button\tgo', 'toggle\tlog\tLog\t2',
      'choice\tmode\tMode\trace\teco,sport', 'choice\tm\tM\ta\ta,a', 'choice\tm\tM\ta\t' + Array(13).fill('a').map((a, i) => a + i).join(','),
      'progress\tOil\t101', 'progress\tOil\t07', 'slider\tx\tX', 'text\t' + 'é'.repeat(61), 'text\ta\u0001',
      'button\tgo\tGo', 'button\tgo\tAgain'];
    const page = parseCompanion(`COMPANION\tready\n1\n${bad.join('\n')}\n`);
    expect(page).toEqual({ on: true, sequence: '1', widgets: [{ kind: 'button', id: 'go', label: 'Go' }] });
    expect(parseCompanion('COMPANION\tready\n1\ntext\t' + 'é'.repeat(60) + '\n')).toMatchObject({ widgets: [{ kind: 'text' }] });
  });

  it.each([
    'COMPANION\tready\n', 'COMPANION\tready\nx\ntext\ta\n', 'COMPANION\tready\n01\n', 'COMPANION\ton\n',
    'COMPANION\tready\n1\ntext\ta', `COMPANION\tready\n1\n${'text\ta\n'.repeat(WIDGETS_MAX + 1)}`,
  ])('rejects a malformed reply %#', text => expect(() => parseCompanion(text)).toThrow());

  it('checks event values', () => {
    expect(isValue('', true) && isValue('eco') && !isValue('') && !isValue('a,b') && !isValue('a\tb')
      && !isValue('x'.repeat(25))).toBe(true);
  });
});
