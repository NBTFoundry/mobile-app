// SPDX-License-Identifier: MPL-2.0
const files = new Map<string, string>();
jest.mock('expo-file-system', () => ({
  Paths: { document: 'doc' },
  File: class {
    constructor(private readonly dir: string, private readonly name: string) {}
    get exists() { return files.has(`${this.dir}/${this.name}`); }
    async text() { return files.get(`${this.dir}/${this.name}`) ?? ''; }
    async write(text: string) { files.set(`${this.dir}/${this.name}`, text); }
  },
}));
jest.mock('../modules/car-link', () => ({ CarLink: {} }));
jest.mock('../modules/device-key', () => ({ DeviceKey: {} }));

import { describeError, describeManagerAccepted, describeOpening, describeStatus } from '../src/car/messages';
import {
  LANGUAGES, catalogs, currentChoice, currentLanguage, languageFor, setChoice, setSystemLocale, t, tn,
} from '../src/i18n';
import { connectError, initialState, reduce } from '../src/installer/state';
import { CarError, LinkError } from '../src/protocol/session';
import { chooseAppearance, chooseAutoCheck, chooseBetas, chooseLanguage, chooseTheme, loadPreferences, preferences, showBetas } from '../src/store/preferences';

/** A count's singular may name {count} or not (French uses it for 0 too); tn always gives it. */
const placeholders = (text: string, key: string) =>
  (text.match(/\{\w+\}/g) ?? []).filter(p => !(key.endsWith('.one') && p === '{count}')).sort();

afterEach(() => {
  setChoice('auto');
  setSystemLocale('en_US');
  files.clear();
});

describe('languages', () => {
  it('has every English text in every language, with the same placeholders', () => {
    const all = catalogs();
    const keys = Object.keys(all.en).sort();
    for (const language of LANGUAGES) {
      expect(Object.keys(all[language]).sort()).toEqual(keys);
      for (const key of keys) {
        const text = all[language][key as keyof typeof all.en];
        expect(text.trim()).not.toBe('');
        expect([language, key, placeholders(text, key)])
          .toEqual([language, key, placeholders(all.en[key as keyof typeof all.en], key)]);
      }
    }
  });

  it('follows the phone, English for a language it does not have', () => {
    expect(languageFor('fr_FR')).toBe('fr');
    expect(languageFor('de-AT')).toBe('de');
    expect(languageFor('zh-Hant-TW')).toBe('zh');
    expect(languageFor('ja_JP')).toBe('ja');
    expect(languageFor('nl_NL')).toBe('en');
    expect(languageFor('pt_BR')).toBe('en');
    expect(languageFor('')).toBe('en');
    expect(languageFor(undefined)).toBe('en');
    setSystemLocale('it_IT');
    expect(currentLanguage()).toBe('it');
    expect(t('tab.more')).toBe('Altro');
    setSystemLocale('nl_BE');
    expect(t('tab.more')).toBe('More');
  });

  it('shows a chosen language whatever the phone’s', () => {
    setSystemLocale('es_ES');
    setChoice('ja');
    expect(currentChoice()).toBe('ja');
    expect(t('tab.car')).toBe('車両');
    setSystemLocale('de_DE');
    expect(currentLanguage()).toBe('ja');
    setChoice('auto');
    expect(currentLanguage()).toBe('de');
  });

  it('fills placeholders and picks a count’s form', () => {
    expect(t('app.updateTo', { version: 'v2' })).toBe('Update to v2');
    expect(t('car.readAt')).toBe('read {time}');
    expect(tn('cars.apps', 1)).toBe('1 application');
    expect(tn('cars.apps', 0)).toBe('0 applications');
    setChoice('fr');
    expect(tn('cars.apps', 0)).toBe('0 application');
    expect(tn('cars.apps', 2)).toBe('2 applications');
    setChoice('de');
    expect(tn('op.settingsRead', 3)).toBe('3 Einstellungen gelesen.');
  });

  it('turns failures and the car’s states into the language shown', () => {
    setChoice('fr');
    expect(describeError(new LinkError('refused'))).toBe('La voiture n’a pas répondu. Ouvrez App Manager sur la voiture.');
    expect(describeError(new Error('raw native text'))).toBe('Une erreur s’est produite.');
    expect(describeStatus({ state: 'failed', message: 'Update failed; previous application restored' }))
      .toBe('La voiture a signalé un échec. Update failed; previous application restored.');
    // An approved manager release: restarted at once from 0.5.2, else at the next opening.
    expect(describeManagerAccepted({ state: 'installed', message: 'NBT Manager 0.5.3 starts in a moment' }))
      .toBe('Terminé. NBT Manager redémarre maintenant avec cette version.');
    expect(describeManagerAccepted({ state: 'installed', message: 'NBT Manager 0.5.2 starts when App Manager opens again' }))
      .toBe('Terminé. Il démarre à la prochaine ouverture d’App Manager.');
    expect(describeOpening({ kind: 'by-hand', reason: 'moving' }))
      .toBe('Arrêtez d’abord la voiture. Ouvrez App Manager sur la voiture ; l’action continue dès son ouverture.');
    expect(describeError(new CarError(413, 'phone-size')))
      .toBe('Trop grand pour être envoyé depuis un téléphone. Importez-le depuis une clé USB dans la voiture.');
    expect(describeError(new CarError(404, 'app'))).toBe('Cette application ne prend pas de fichiers.');
    // An older manager has no files routes.
    expect(describeError(new CarError(404, 'route'))).toBe('Mettez à jour NBT Manager sur la voiture.');
    setChoice('zh');
    expect(connectError('no-wifi')).toBe('请先连接适配器的 Wi-Fi。');
    expect(reduce(initialState(), { type: 'log', kind: 'system', uri: null, size: 0 }, 0).result).toBe('无法保存iDrive 日志。');
  });

  it('keeps the choice, and ignores a saved one it does not know', async () => {
    expect(await chooseLanguage('it')).toBe(true);
    expect(JSON.parse(files.get('doc/preferences.json')!)).toEqual({ language: 'it', betas: false });
    setChoice('auto');
    await loadPreferences();
    expect(currentChoice()).toBe('it');
    for (const saved of ['{"language":"nl"}', '{"language":7}', 'not json', 'null']) {
      setChoice('auto');
      files.set('doc/preferences.json', saved);
      await loadPreferences();
      expect([saved, currentChoice()]).toEqual([saved, 'auto']);
    }
  });

  it('keeps betas beside the language', async () => {
    setChoice('fr');
    expect(await chooseBetas(true)).toBe(true);
    expect(JSON.parse(files.get('doc/preferences.json')!)).toEqual({ language: 'fr', betas: true });
    await chooseBetas(false);
    files.set('doc/preferences.json', '{"language":"fr","betas":true}');
    await loadPreferences();
    expect(showBetas()).toBe(true);
    await chooseBetas(false);
  });

  it('keeps the appearance, the theme and the start-up choices; a default is not written', async () => {
    await chooseAppearance('dark');
    await chooseTheme('supra');
    await chooseAutoCheck(false);
    expect(JSON.parse(files.get('doc/preferences.json')!)).toEqual(
      { language: 'auto', betas: false, appearance: 'dark', theme: 'supra', autoCheck: false });
    await chooseAppearance('auto');
    await chooseTheme('car');
    await chooseAutoCheck(true);
    expect(JSON.parse(files.get('doc/preferences.json')!)).toEqual({ language: 'auto', betas: false });
    // A saved value this app does not know leaves the default: connecting off, looking for new versions on.
    files.set('doc/preferences.json', '{"appearance":"sepia","theme":"rolls","autoConnect":"yes","autoCheck":0,"diagnostics":1}');
    await loadPreferences();
    expect(preferences()).toMatchObject({ appearance: 'auto', theme: 'car', autoConnect: false, autoCheck: true });
    expect(preferences().diagnostics).toBeUndefined();
    files.set('doc/preferences.json', '{"appearance":"light","theme":"mini","autoConnect":true,"autoCheck":false,"diagnostics":false}');
    await loadPreferences();
    expect(preferences()).toMatchObject({ appearance: 'light', theme: 'mini', autoConnect: true, autoCheck: false, diagnostics: false });
    await chooseAutoCheck(true);
    await chooseAppearance('auto');
    await chooseTheme('car');
  });
});
