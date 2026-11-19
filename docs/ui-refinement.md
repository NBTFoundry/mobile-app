# UI refinement

The app uses three labelled tabs, Car, Library and Activity. Car combines the
paired car and its applications. Car management, application details, pairing
and the manager installer open as pages with a header Back action. Android Back
dismisses a modal first, then returns to the parent page. The installer session
continues to own its work while its page is closed.

## Design decisions

- Neutral surfaces follow the system light or dark appearance. One blue accent
  identifies actions, selected tabs and available updates. Shared semantic colors
  cover text, input fields, logs, status and dialogs.
- Each page gives its main action priority. Logs, rename, forget and application
  removal are grouped in context menus. Advanced installer tools stay folded.
- Cars and their cached applications load independently from package verification.
  Opening the app or Library makes no connection attempt. Selecting a car,
  Connect, Refresh and car actions explicitly request the network.
- An unread application list has its own message. A successful empty list says
  that no applications are installed. The dashboard shows when it last read it.
- App details offer the newest eligible package as the primary install or update
  action. Equal and older ordinary application sequences are informational.
  The car still checks its high-water mark and decides whether to accept a file.
  NBT Manager releases use their existing dedicated update flow.
- Settings load on request. Their current values appear in rows, with choices in
  a modal. Package details show filename, version, size, sequence and added date.
- Pairing digits appear only while confirmation is pending. Camera denial that
  prevents another request offers app settings. App installation and removal
  require approval on the car. The separate SSH manager installer keeps explicit
  SSH consent, removal confirmation and one visible restart action.
- Touch targets are at least 48 dp. Labels wrap, dialogs scroll, inputs remain
  accessible with the keyboard open, and status always includes text.

The routing stays local to App.tsx. Application pages retain their car ID and
reset local state when the target changes. Car writes are serialized. Delayed
application reads merge into the current record, preserving a name change and
never recreating a forgotten pairing. A requested network release waits for the
current action to finish. The existing signed request queue and two-minute
background/five-minute idle network holds remain in effect.

## References

The research pass used [Google Home navigation and home selection](https://support.google.com/googlehome/answer/7071794),
[Android Settings grouping and disclosure](https://source.android.com/docs/core/settings/settings-guidelines),
[Files contextual management](https://support.google.com/files/answer/9746888),
and [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps).
Implementation checked Expo SDK 58's [appearance configuration](https://github.com/expo/expo/blob/expo@58.0.22/docs/pages/develop/user-interface/color-themes.mdx).
Android automatic appearance requires expo-system-ui and a native rebuild.

## Verification

Automated checks are recorded in HANDOVER.md. Simulator checks use a disposable
API 36 x86_64 AVD and a local debug build. Screenshots and build output are local
ignored artifacts under build/ui-review-tmp/.

The simulator covers first use, paired and populated cars, Library imports and
package details, install and update requests, settings, car-declined uninstall,
activity results, application logs, installer connection settings, light/dark
switching, Back, narrow width and enlarged text. Desk-car behavior is a host
fixture, not a head-unit test. Real Wi-Fi joining, physical-phone interaction,
real-camera scanning, SSH installation and release signing need separate checks.
