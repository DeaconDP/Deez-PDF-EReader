# iOS / App Store

(Xcode)

DeezPDF Reader includes a native iOS wrapper via [Capacitor](https://capacitorjs.com). The web app lives in `dist/`; Capacitor ships it inside a native shell you can open in Xcode.

### Requirements

- macOS with **Xcode** installed (from the Mac App Store)
- An **Apple Developer** account for device testing, TestFlight, or App Store upload
- Node.js (same as the rest of the project)

### Open in Xcode

After `npm install`:

```bash
npm run ios
```

This builds the app, syncs assets into `ios/`, and opens **`ios/App/DeezPDF.xcodeproj`** in Xcode.

> **After editing web/TypeScript code**, run `npm run cap:sync` before rebuilding in Xcode. Use `npm run build:ios` (not plain `npm run build`) so assets use relative paths Capacitor needs. `App.xcodeproj` is a symlink to `DeezPDF.xcodeproj` for Capacitor CLI compatibility.

To sync again after web changes without opening Xcode:

```bash
npm run cap:sync
```

### Run on a device or simulator

1. In Xcode, select the **App** scheme and a simulator or connected iPhone.
2. Open **Signing & Capabilities** and choose your **Team**.
3. Confirm the bundle ID (`online.deac.deezpdf`) or change it to one you own.
4. Press **Run** (⌘R).

### Upload to App Store / TestFlight

1. Sync the latest web build: `npm run ios:archive` (or `npm run cap:sync` before archiving in Xcode).
2. In Xcode, set **Version** (`1.0`) and **Build** (`1`) under the App target (General tab) — bump **Build** for each upload.
3. Choose **Any iOS Device** as the run destination.
4. **Product → Archive**, then **Distribute App** → **App Store Connect** → **Upload**.
5. In [App Store Connect](https://appstoreconnect.apple.com), add metadata, screenshots, and submit for review.

CLI alternative after archiving:

```bash
npm run ios:archive   # creates build/DeezPDF.xcarchive
npm run ios:export    # creates build/export/*.ipa — upload via Transporter or Organizer
```

> If `xcodebuild` fails with “requires Xcode”, point the active developer directory at the full app:  
> `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`  
> The archive scripts also set `DEVELOPER_DIR` automatically when Xcode is installed.

Export compliance is preconfigured (`ITSAppUsesNonExemptEncryption = false`) because the app uses only standard HTTPS and local storage.

### iOS notes

- **Add PDF** works via the native file picker.
- **Add Folder** is hidden on iOS (not supported in mobile Safari/WebKit).
- PDFs stay on-device in IndexedDB — same privacy model as the web app.
- Regenerate icons/splash assets anytime with `npm run icons`.

---
