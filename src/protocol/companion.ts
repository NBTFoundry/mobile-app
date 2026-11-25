// SPDX-License-Identifier: MPL-2.0
/** An application's phone page (the manager's docs/companion-bridge.md): `COMPANION\toff\n`,
 * or `COMPANION\tready\n`, a sequence line and one widget per line. The page comes from the
 * application: a malformed widget is left out, not the page. */
import { ProtocolError, isU64 } from './bytes';
import { MAX_REPLY } from './replies';

export type Widget =
  | { kind: 'title'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'button'; id: string; label: string }
  | { kind: 'toggle'; id: string; label: string; on: boolean }
  | { kind: 'choice'; id: string; label: string; value: string; choices: string[] }
  | { kind: 'progress'; label: string; percent: number };

export type CompanionPage = { on: false } | { on: true; sequence: string; widgets: Widget[] };

export const WIDGETS_MAX = 32;
const ID = /^[a-z0-9_-]{1,24}$/;
const CONTROL = /[\x00-\x1f\x7f]/;

/** UTF-8 bytes of `text`. */
function utf8Length(text: string): number {
  let n = 0;
  for (const c of text) {
    const code = c.codePointAt(0)!;
    n += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return n;
}

const isText = (s: string | undefined): s is string =>
  !!s && !CONTROL.test(s) && utf8Length(s) <= 120;
/** A choice, or an event's value: up to 24 bytes, no comma (`empty`: may be empty). */
export const isValue = (s: string | undefined, empty = false): s is string =>
  s !== undefined && (empty || s.length > 0) && !CONTROL.test(s) && !s.includes(',') && utf8Length(s) <= 24;
export const isWidgetId = (s: string | undefined): s is string => !!s && ID.test(s);

function widget(line: string): Widget | undefined {
  const [kind, a, b, c, d, ...rest] = line.split('\t');
  if (rest.length) return undefined;
  switch (kind) {
    case 'title':
    case 'text':
      return isText(a) && b === undefined ? { kind, text: a } : undefined;
    case 'button':
      return isWidgetId(a) && isText(b) && c === undefined ? { kind, id: a, label: b } : undefined;
    case 'toggle':
      return isWidgetId(a) && isText(b) && (c === '0' || c === '1') && d === undefined
        ? { kind, id: a, label: b, on: c === '1' } : undefined;
    case 'choice': {
      const choices = d?.split(',') ?? [];
      return isWidgetId(a) && isText(b) && isValue(c) && choices.length <= 12 && choices.includes(c)
        && choices.every(v => isValue(v)) && new Set(choices).size === choices.length
        ? { kind, id: a, label: b, value: c, choices } : undefined;
    }
    case 'progress':
      return isText(a) && c === undefined && b !== undefined && /^(0|[1-9][0-9]?|100)$/.test(b)
        ? { kind, label: a, percent: Number(b) } : undefined;
    default:
      return undefined;
  }
}

export function parseCompanion(text: string): CompanionPage {
  if (text === 'COMPANION\toff\n') return { on: false };
  if (text.length > MAX_REPLY || !text.startsWith('COMPANION\tready\n') || !text.endsWith('\n')) {
    throw new ProtocolError('bad-reply');
  }
  const [sequence, ...lines] = text.slice(16, -1).split('\n');
  if (!sequence || !isU64(sequence, true) || lines.length > WIDGETS_MAX) throw new ProtocolError('bad-reply');
  const ids = new Set<string>();
  const widgets: Widget[] = [];
  for (const line of lines) {
    const w = widget(line);
    if (!w) continue;
    if ('id' in w) {
      if (ids.has(w.id)) continue;
      ids.add(w.id);
    }
    widgets.push(w);
  }
  return { on: true, sequence, widgets };
}
