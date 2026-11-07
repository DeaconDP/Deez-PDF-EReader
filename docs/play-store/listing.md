# DeezPDF on Google Play

Package `online.deac.deezpdf` · version 1.1 (versionCode 16) · targetSdk 36 · Play developer account **Worldbuild.io** (owner deacondp@gmail.com).

Mirrors the iOS App Store listing (`store/listing/en-GB/`, App Store id 6782567924). Default language **English (United Kingdom) – en-GB**.

## Main store listing

| Field | Value |
|---|---|
| App name (≤30) | `DeezPDF` |
| Short description (≤80) | `Your local PDF reader` |
| Full description (≤4000) | see below |
| App icon | `docs/play-store/assets/icon-512.png` (512×512, 32-bit PNG) |
| Feature graphic | `docs/play-store/assets/feature-graphic-1024x500.png` |
| Phone screenshots | `docs/play-store/assets/screenshots/` |

Full description:

> DeezPDF is a PDF reader with a local library. Read PDFs page-by-page like a Kindle, with swipe navigation and automatic progress saving. All your PDFs stay on your device — nothing is uploaded anywhere. Created by deac.online @ worldbuild.io

## Store settings

| Field | Value |
|---|---|
| App or game | App |
| Free or paid | Free |
| Category | Books & Reference |
| Tags | Books & reference, PDF reader / e-reader (pick the closest offered) |
| Contact email | d@worldbuild.io |
| Website | https://www.worldbuild.io/ |
| Privacy policy | https://worldbuild.io/privacy |

## App content (Policy → App content)

- **Privacy policy:** https://worldbuild.io/privacy
- **Ads:** No, the app does not contain ads.
- **App access:** All functionality is available without special access (no login).
- **Target audience and content:** 13+ (13–15, 16–17, 18+). Not designed for children: the online search reaches the open public catalogues of Internet Archive and Project Gutenberg, which the app does not curate, so don't opt into Families.
- **Content rating (IARC questionnaire):** category **Reference, News, or Educational**. Answer *No* to violence, sexuality, language, controlled substances, gambling and crude humour. Users interact or exchange content: **No**. Shares the user's location: **No**. Digital purchases: **No**. Unrestricted internet access / web browsing: **No** (it only searches the Gutenberg and Internet Archive catalogues and downloads PDFs from links the user enters; it isn't a general web browser). Expected result: Everyone / PEGI 3. Email for the certificate: d@worldbuild.io.
- **Data safety:** see below.
- **Government apps:** No. **Financial features:** None. **Health:** None. **News app:** No.
- **Advertising ID:** the app does not use it (no ad or analytics SDKs).

## Data safety

Answer: **"Does your app collect or share any of the required user data types?" → No.** Also: data is encrypted in transit (all endpoints are HTTPS), and the user can delete their data (remove a book in the app, or uninstall).

Checked against the code on branch `android/play-launch`:

| Network call | Where | What leaves the device |
|---|---|---|
| Project Gutenberg catalogue (`gutendex.com`) | `src/lib/lookup/gutenberg.ts` | The search text the user typed, sent straight to that public catalogue |
| Internet Archive (`archive.org` search, metadata, download) | `src/lib/lookup/archive-org.ts` | The search text, then the chosen item |
| Download from a link | `src/lib/download.ts` (CapacitorHttp in the app) | A GET request to the URL the user entered |
| Web search (`https://deac.online/api/pdf-search`) | `src/lib/lookup/web-search.ts` | The search text, sent to **Dale's own server**. The endpoint currently returns 404, so nothing is received today |

- There are no analytics, crash reporting, ads, accounts or identifiers. Preferences are in `localStorage` and PDFs in IndexedDB, both on the device only.
- The only permission is `INTERNET`.
- The Gutenberg, Archive and link requests happen only when the user asks, and go to the service they asked for. Play treats that as not collected by the developer.
- **Caveat: the web search.** If `deac.online/api/pdf-search` is ever deployed, search text will reach a server Dale runs. Play counts that as collection, so you'd then declare **App activity → Other user-generated content / In-app search history**: collected, not shared, processed ephemerally, optional, for app functionality. Alternatively, hide the "Web" source on Android until it exists.

## Release

- **Upload key:** `~/.android-keys/deezpdf-upload.jks` (alias `deezpdf`). The password is only in the macOS login Keychain (service `deezpdf-upload-keystore`, account `deezpdf`). Upload certificate SHA-256: `5C:CE:82:9E:65:94:A2:9C:CF:F8:B8:70:1A:E8:E4:C1:43:DC:A3:BD:48:29:27:60:85:72:02:AF:EF:72:C4:E9`.
- **Play App Signing:** on. Google holds the app signing key, and the file above is only the upload key.
- **Build:** `npm run android:bundle` builds `android/app/build/outputs/bundle/release/app-release.aab`. It needs JDK 21 (`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home`) and `android/local.properties` with `sdk.dir`.
- **Track:** Internal testing first, with tester deacondp@gmail.com. Production waits for Dale's go-ahead.
- **Release notes (en-GB):** `First Android release: read PDFs page-by-page, keep a local library on your device, and find free public-domain books.`

## Play Console steps (signed in as deacondp@gmail.com)

The Play Developer API can't create apps, and there's no service account on this Mac, so the first release goes through the Console, as Mochi's did.

1. Go to play.google.com/console, choose **Worldbuild.io** (account 5072169749072310170, not the removed "worldbuild.io" one), then **Create app**. Fill in: name `DeezPDF`, default language English (United Kingdom), App, Free. Tick the two declarations, then **Create app**.
2. Under **Testing → Internal testing**, open **Testers**, create the email list "DeezPDF internal" with `deacondp@gmail.com`, and save. Copy the **opt-in link** shown there.
3. Still under **Internal testing**: **Create new release**, confirm Play App Signing ("Use Google-generated key"), and upload `app-release.aab`. Paste the release notes, then **Next → Save → Start rollout to Internal testing**.
4. Open **Dashboard → Set up your app** and fill in each section from this file: privacy policy, app access, ads, content rating, target audience, data safety, government apps, financial features, health, and the store listing with assets from `docs/play-store/assets/`.
5. Don't promote to production until Dale has tested the build.
