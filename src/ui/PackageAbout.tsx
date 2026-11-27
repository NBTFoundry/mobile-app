// SPDX-License-Identifier: MPL-2.0
/** What a package says about itself for people (`property=` and `text=` lines),
 * and what it may do to the car (its permissions, protocol/permissions.ts):
 * shown as the package declares them, before the car has verified it. Two lines
 * of description at first; "More details" opens the rest. */
import { useState } from 'react';
import { View } from 'react-native';
import { t, type Key } from '../i18n';
import { permissionLabels } from '../protocol/permissions';
import type { PackageInfo } from '../protocol/packageHeader';
import { aboutText, hasMore } from './about';
import { Body, Button, Label } from './kit';

function permissionLines(bits: number | undefined): string[] {
  if (!bits) return [];
  const { uses, can, driving } = permissionLabels(bits);
  const join = (keys: string[]) => keys.map(k => t(k as Key)).join(t('perm.separator'));
  const lines: string[] = [];
  if (uses.length) lines.push(t('perm.uses', { list: join(uses) }));
  if (can.length) {
    const how = driving === undefined ? '' : ` ${t(driving ? 'perm.driving' : 'perm.parked')}`;
    lines.push(t('perm.can', { list: join(can) + how }));
  }
  return lines;
}

/** A line of release notes: a heading, an item or a sentence. */
function Note({ line }: { line: string }) {
  if (line.startsWith('### ')) return <Label plain>{line.slice(4)}</Label>;
  return <Body>{line.startsWith('- ') ? `• ${line.slice(2)}` : line}</Body>;
}

/** `summary`: the catalog's line about the application, shown first; `notes`: what is
 * new in this release (the catalog's, from the release's page). */
export function PackageAbout({ info, summary, notes = [] }: {
  info: Pick<PackageInfo, 'properties' | 'text' | 'permissions'>; summary?: string; notes?: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const properties = info.properties ?? [];
  const permissions = permissionLines(info.permissions);
  const about = aboutText(info.text, summary);
  const more = hasMore(about, properties.length + permissions.length + notes.length);
  if (!about.lead && !more) return null;
  return <View style={{ gap: 4 }}>
    {about.lead ? <Body lines={open ? undefined : 2}>{about.lead}</Body> : null}
    {open ? <>
      {notes.length ? <View style={{ gap: 4, paddingVertical: 8 }}>
        <Label>{t('whatsNew.title')}</Label>
        {notes.map((line, i) => <Note key={`n${i}`} line={line} />)}
      </View> : null}
      {about.rest.map((p, i) => <Body key={`t${i}`} muted>{p}</Body>)}
      {properties.map((p, i) => <Body key={`p${i}`}>{`${p.label}: ${p.value}`}</Body>)}
      {permissions.map((line, i) => <Body key={`r${i}`}>{line}</Body>)}
    </> : null}
    {more ? <Button label={t(open ? 'log.fewer' : 'log.more')} kind="plain" expanded={open}
      onPress={() => setOpen(!open)} /> : null}
  </View>;
}
