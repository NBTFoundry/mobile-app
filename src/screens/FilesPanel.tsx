// SPDX-License-Identifier: MPL-2.0
/** An application's files on the car: listed, added from this phone, deleted after a question here. */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { View } from 'react-native';
import { deleteFile, loadFiles, uploadFile } from '../car/files';
import { PHONE_FILE_MAX, extensionOf, isFolderEntry, storedName, type CarFile, type FileListing } from '../protocol/files';
import { Stop } from '../protocol/session';
import type { CarRecord } from '../store/cars';
import { Body, Busy, Button, Label, Progress, Row, formatSize } from '../ui/kit';
import { Dialog } from '../ui/Dialog';
import { t, tn } from '../i18n';

/** Drops a picked file's copy in the app's cache. */
function discard(uri: string): void {
  try {
    new File(uri).delete();
  } catch {
    // Android clears the cache by itself.
  }
}

/** The modal a transfer shows: which file, its bytes so far, Cancel. */
type Sending = { index: number; count: number; name: string; sent: number; total: number; stop: Stop };

function SendingDialog({ sending }: { sending: Sending }) {
  const { index, count, name, sent, total, stop } = sending;
  const fraction = total ? sent / total : 0;
  return <Dialog title={t('files.sendingTitle')} closeLabel={t('common.cancel')} onClose={() => stop.stop()}>
    <Body>{t('files.progressFile', { index, count, name })}</Body>
    <Progress value={fraction} />
    <Body muted>{stop.stopped ? t('files.stopping')
      : t('files.progressBytes', { sent: formatSize(sent), total: formatSize(total), percent: Math.floor(fraction * 100) })}</Body>
  </Dialog>;
}

export function FilesPanel({ car, appId }: { car: CarRecord; appId: string }) {
  /** Not read yet, null when the application takes no files. */
  const [listing, setListing] = useState<FileListing | null>();
  const [busy, setBusy] = useState<string>();
  const [notes, setNotes] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<CarFile>();
  const [sending, setSending] = useState<Sending>();
  const reload = async (out: string[]) => {
    setBusy(t('files.reading'));
    const result = await loadFiles(car, appId);
    if (result !== undefined) setListing(result);
    else out.push(t('files.readFailed'));
    setBusy(undefined);
    setNotes(out);
  };
  const add = async (current: FileListing) => {
    setNotes([]);
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true, type: '*/*' })
      .catch(() => undefined);
    if (!picked || picked.canceled) return;
    const limit = Math.min(current.largest, PHONE_FILE_MAX);
    const out: string[] = [];
    let failed = false;
    const stop = new Stop();
    const count = picked.assets.length;
    // Re-rendered on Cancel too, so the dialog says it is stopping.
    stop.bind(() => setSending(old => old && { ...old }));
    setBusy(t('files.sendingTitle'));
    for (const [index, asset] of picked.assets.entries()) {
      const name = storedName(asset.name);
      if (stop.stopped) {
        // Not sent: the user stopped before its turn.
      } else if (!name || !current.extensions.includes(extensionOf(name))) {
        out.push(t('files.notAccepted', { name: asset.name }));
      } else if (asset.size !== undefined && asset.size > limit) {
        out.push(t('files.tooLarge', { name: asset.name }));
      } else {
        setSending({ index: index + 1, count, name, sent: 0, total: asset.size ?? 0, stop });
        const sent = await uploadFile(car, appId, { uri: asset.uri, name }, stop, (bytes, total) =>
          setSending(old => old && { ...old, sent: bytes, total }));
        if (!sent && !stop.stopped) failed = true;
      }
      discard(asset.uri);
    }
    setSending(undefined);
    if (stop.stopped) out.push(t('files.stopped'));
    else if (failed) out.push(t('files.sendFailed'));
    await reload(out);
  };
  const remove = async (file: CarFile) => {
    setDeleting(undefined); setBusy(t('files.deleting')); setNotes([]);
    if (!await deleteFile(car, appId, file.name)) setNotes([t('files.deleteFailed')]);
    else if (isFolderEntry(file.name)) {
      await reload([]); // a game folder held several files
      return;
    } else {
      setListing(old => old && { ...old, count: Math.max(0, old.count - 1), used: Math.max(0, old.used - file.size),
        files: old.files.filter(f => f.name !== file.name) });
    }
    setBusy(undefined);
  };
  const usage = (l: FileListing) =>
    `${tn('files.count', l.count)} · ${t('files.usage', { used: formatSize(l.used), quota: formatSize(l.quota) })}`;
  return <>
    <Label>{t('files.title')}</Label>
    {listing === undefined ? <Row title={t('files.read')} detail={t('files.readDetail')}
      onPress={!busy ? () => void reload([]) : undefined} />
      : listing === null ? <Body muted>{t('files.none')}</Body>
        : <>
          <Body muted>{usage(listing)}</Body>
          {listing.files.length ? <View>{listing.files.map(file => <Row key={file.name} title={file.name}
            detail={isFolderEntry(file.name) ? t('files.folderDetail', { size: formatSize(file.size) })
              : formatSize(file.size)} onPress={!busy ? () => setDeleting(file) : undefined} />)}</View>
            : <Body muted>{t('files.empty')}</Body>}
          <Button label={t('files.add')} disabled={!!busy} onPress={() => void add(listing)} />
          <Body muted>{t('files.accepts', { extensions: listing.extensions.map(e => `.${e}`).join(' '),
            size: formatSize(Math.min(listing.largest, PHONE_FILE_MAX)) })}</Body>
          <Body muted>{t('files.usb')}</Body>
        </>}
    {busy ? <Busy text={busy} /> : null}
    {notes.map(note => <Body key={note}>{note}</Body>)}
    {sending ? <SendingDialog sending={sending} /> : null}
    {deleting ? <Dialog title={t('files.deleteQuestion')} onClose={() => setDeleting(undefined)}>
      <Body>{t(isFolderEntry(deleting.name) ? 'files.deleteFolderBody' : 'files.deleteBody', { name: deleting.name })}</Body>
      <Button label={t('files.delete')} kind="danger" onPress={() => void remove(deleting)} />
    </Dialog> : null}
  </>;
}
