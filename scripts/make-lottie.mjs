#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
// Writes the app's Lottie animations (src/ui/lottie/*.json). They are drawn here, from
// shapes, so that they stay small, ours, and readable:
//
//   working   an arc going round: something is being read or saved
//   connect   waves from a point: the car's Wi-Fi is being joined
//   transfer  the phone, the car's screen, and what travels between them
//   confirm   the car's screen asking, and the controller to press
//   done      a circle and a tick, drawn once
//   failed    a circle and a cross, drawn once
//
//   yarn lottie
//
// Colours are placeholders: the app paints each layer by its name (src/ui/Lottie.tsx):
// ink, muted, line, accent, and mark for done and failed.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/ui/lottie');
const SIZE = 120;
const BLUE = [0.36, 0.61, 0.94, 1];

const still = k => ({ a: 0, k });
const EASE = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };
const LINEAR = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
/** Keyframes [[frame, value], ...]; the last one only holds its value. */
const keys = (frames, curve = EASE) => ({ a: 1, k: frames.map(([t, value], n) => {
  const s = [].concat(value);
  return n === frames.length - 1 ? { t, s } : { t, s, ...curve };
}) });

const ellipse = (x, y, d) => ({ ty: 'el', nm: 'ellipse', p: still([x, y]), s: still([d, d]), d: 1 });
const rect = (x, y, w, h, r = 0) => ({ ty: 'rc', nm: 'rect', p: still([x, y]), s: still([w, h]), r: still(r), d: 1 });
const line = (...points) => ({ ty: 'sh', nm: 'path', ks: still({ i: points.map(() => [0, 0]), o: points.map(() => [0, 0]),
  v: points, c: false }) });
const trim = (end, start = still(0), offset = still(0)) => ({ ty: 'tm', nm: 'trim', s: start, e: end, o: offset, m: 1 });
const stroke = (w = 6) => ({ ty: 'st', nm: 'stroke', c: still(BLUE), o: still(100), w: still(w), lc: 2, lj: 2 });
const fill = () => ({ ty: 'fl', nm: 'fill', c: still(BLUE), o: still(100), r: 1 });
const group = (...items) => ({ ty: 'gr', nm: 'group', it: [...items, { ty: 'tr', nm: 'transform', p: still([0, 0]),
  a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) }] });

/** A shape layer named after the colour that paints it; `at`: where its origin sits. */
function layer(name, shapes, { at = [0, 0], opacity = still(100), rotation = still(0), scale = still([100, 100, 100]) } = {}) {
  return { ddd: 0, ty: 4, nm: name, sr: 1, ao: 0, bm: 0, st: 0, ip: 0, shapes,
    ks: { o: opacity, r: rotation, p: still([...at, 0]), a: still([0, 0, 0]), s: scale } };
}

function animation(name, frames, layers) {
  return { v: '5.7.4', fr: 60, ip: 0, op: frames, w: SIZE, h: SIZE, nm: name, ddd: 0, assets: [],
    layers: layers.map((item, n) => ({ ...item, ind: n + 1, op: frames })) };
}

/** Opacity that rises at `start`, holds, and falls back before the loop ends. */
const blink = (start, frames, low = 22) => keys([[0, low], [start, low], [start + 10, 100], [start + 30, 100],
  [Math.min(frames, start + 44), low], [frames, low]].filter(([t], n, all) => n === 0 || t > all[n - 1][0]));

const animations = {
  working: animation('working', 60, [
    layer('accent', [group(ellipse(0, 0, 72), trim(still(28)), stroke())],
      { at: [60, 60], rotation: keys([[0, 0], [60, 360]], LINEAR) }),
    layer('line', [group(ellipse(0, 0, 72), stroke())], { at: [60, 60] }),
  ]),
  connect: animation('connect', 84, [
    layer('accent', [group(ellipse(60, 92, 12), fill())]),
    ...[40, 68, 96].map((d, n) => layer('accent',
      [group(ellipse(60, 92, d), trim(still(25), still(0), still(-45)), stroke())], { opacity: blink(6 + n * 12, 84) })),
  ]),
  transfer: animation('transfer', 72, [
    ...[47, 56, 65].map((x, n) => layer('accent', [group(ellipse(x, 58, 6), fill())], { opacity: blink(4 + n * 10, 72) })),
    layer('muted', [group(rect(26, 58, 26, 44, 5), stroke(4)), group(line([22, 73], [30, 73]), stroke(4)),
      group(line([84, 86], [100, 86]), line([92, 78], [92, 86]), stroke(4))]),
    layer('ink', [group(rect(92, 58, 40, 36, 5), stroke(4))]),
  ]),
  confirm: animation('confirm', 90, [
    layer('accent', [group(rect(74, 44, 22, 12, 3), fill())], { opacity: keys([[0, 35], [45, 100], [90, 35]]) }),
    layer('line', [group(rect(46, 44, 22, 12, 3), fill())]),
    layer('ink', [group(rect(60, 44, 76, 46, 6), stroke(4))]),
    layer('accent', [group(ellipse(0, 0, 22), stroke(4))], { at: [60, 96],
      scale: keys([[0, [100, 100, 100]], [60, [190, 190, 100]], [90, [190, 190, 100]]]),
      opacity: keys([[0, 80], [60, 0], [90, 0]]) }),
    layer('muted', [group(ellipse(60, 96, 22), stroke(4)), group(ellipse(60, 96, 6), fill())]),
  ]),
  done: animation('done', 48, [
    layer('mark', [group(line([43, 61], [55, 73], [78, 47]), trim(keys([[0, 0], [16, 0], [40, 100]])), stroke(7))]),
    layer('mark', [group(ellipse(60, 60, 76), trim(keys([[0, 0], [26, 100]])), stroke())], { opacity: still(45) }),
  ]),
  failed: animation('failed', 48, [
    layer('mark', [group(line([47, 47], [73, 73]), trim(keys([[0, 0], [16, 0], [32, 100]])), stroke(7)),
      group(line([73, 47], [47, 73]), trim(keys([[0, 0], [24, 0], [40, 100]])), stroke(7))]),
    layer('mark', [group(ellipse(60, 60, 76), trim(keys([[0, 0], [26, 100]])), stroke())], { opacity: still(45) }),
  ]),
};

mkdirSync(out, { recursive: true });
for (const [name, body] of Object.entries(animations)) {
  writeFileSync(path.join(out, `${name}.json`), `${JSON.stringify(body)}\n`);
  writeFileSync(path.join(out, `${name}.json.license`), 'SPDX-FileCopyrightText: 2026 Fabien Poussin\nSPDX-License-Identifier: MPL-2.0\n');
}
console.log(`${Object.keys(animations).length} animations in ${out}`);
