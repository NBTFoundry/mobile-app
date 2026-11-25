// SPDX-License-Identifier: MPL-2.0
/** What a package may do to the car, from its signed declaration (the manager's
 * docs/permissions.md and include/nbt/permissions.h: same bits). The car shows
 * the same list before it installs; the phone shows it beforehand. */

export const PERM = {
  background: 0x001,
  carData: 0x002,
  engine: 0x004,
  files: 0x008,
  phoneNet: 0x010,
  mostRead: 0x020,
  mostSend: 0x040,
  mostAny: 0x080,
  clear: 0x100,
  control: 0x200,
  drive: 0x400,
} as const;

const CAPS = /^[a-z][a-z0-9-]{0,23}(,[a-z][a-z0-9-]{0,23})*$/;
const DIAG_CLASSES = ['read', 'codes', 'clear', 'control', 'drive'];

function caps(line: string | undefined): string[] {
  return line && line.length <= 255 && CAPS.test(line) ? line.split(',') : [];
}

function diagPermissions(policy: string): number {
  let out = 0;
  for (const rule of policy.split(',').slice(0, 8)) {
    const classes = rule.slice(3).split('+').filter(c => DIAG_CLASSES.includes(c));
    if (classes.includes('read') || classes.includes('codes')) out |= PERM.engine;
    if (classes.includes('clear')) out |= PERM.clear;
    if (classes.includes('control')) out |= PERM.control;
    if (classes.includes('drive')) out |= PERM.drive;
  }
  return out;
}

function mostPermissions(policy: string): number {
  let out = 0;
  for (const rule of policy.split(',').slice(0, 48)) {
    if (rule.startsWith('rx:') || rule.startsWith('sub:')) out |= PERM.mostRead;
    if (!rule.startsWith('tx:')) continue;
    out |= PERM.mostSend;
    if (rule.startsWith('tx:*') || /\.00[0-2]$/.test(rule)) out |= PERM.mostAny;
  }
  return out;
}

/** The permissions of a manifest's `bridge-*` lines; 0 without a bridge. */
export function permissionsOf(lines: string[]): number {
  const value = (name: string) => lines.find(l => l.startsWith(name + '='))?.slice(name.length + 1);
  const declared = [...caps(value('bridge-uses')), ...caps(value('bridge-optional'))];
  const has = (cap: string) => declared.includes(cap);
  let out = 0;
  if (has('service')) out |= PERM.background;
  if (has('car-data')) out |= PERM.carData;
  if (has('files')) out |= PERM.files;
  if (has('net')) out |= PERM.phoneNet;
  const diag = value('bridge-diag');
  if (has('diag') && diag && diag.length <= 160) out |= diagPermissions(diag);
  const most = value('bridge-most');
  if (has('most') && most && most.length <= 640) out |= mostPermissions(most);
  return out;
}

/** The labels to show, as i18n keys: what it uses, and what it can do to the car. */
export function permissionLabels(bits: number): { uses: string[]; can: string[]; driving?: boolean } {
  const uses = ([['background', PERM.background], ['carData', PERM.carData], ['engine', PERM.engine],
    ['files', PERM.files], ['phoneNet', PERM.phoneNet], ['mostRead', PERM.mostRead]] as const)
    .filter(([, bit]) => bits & bit).map(([key]) => `perm.${key}`);
  const can = ([['clear', PERM.clear], ['control', PERM.control], ['mostAny', PERM.mostAny],
    ['mostSend', PERM.mostSend]] as const)
    .filter(([key, bit]) => (bits & bit) && !(key === 'mostSend' && bits & PERM.mostAny))
    .map(([key]) => `perm.${key}`);
  const driving = bits & (PERM.clear | PERM.control) ? Boolean(bits & PERM.drive) : undefined;
  return { uses, can, driving };
}
