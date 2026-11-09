# DeezPDF on Google Play

Package `online.deac.deezpdf` · version 1.1 (versionCode 16) · targetSdk 36 · Play developer account **Worldbuild.io**.

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
- **Content rating (IARC questionnaire):** category **Reference, News, or Educational**. Answer *No* to violence, sexuality, language, controlled substances, gambling and crude humour. Users interact or exchange content: **No**. Shares the user's location: **No**. Digital purchases: **No**. Unrestricted internet access: **Yes**. It isn't a web browser, but it downloads a PDF from any link the user enters, and Internet Archive results include user-uploaded texts the app doesn't moderate, so answer conservatively. Expected result: a low rating (Everyone / PEGI 3) plus an "Unrestricted internet" interactive element. Email for the certificate: d@worldbuild.io.
  - *As submitted (Nov 2026):* the questionnaire no longer has a "Reference, News, or Educational" category. It was answered as **All Other App Types**. Ratings-relevant content in the package: No. Users interact: No. **Features online content not in the download: Yes.** Violence, sexuality, language, drugs, age-restricted promotion: No. Shares location: No. Digital purchases: No. Cash rewards/NFTs: No. Web browser or search engine: No. **Primarily news or educational: Yes.** Result: ESRB Everyone, PEGI 3, USK all ages, IARC 3+.
- **App-level trader status:** inherits the account's trader status (Yes); no Terms of Service URL.
- **Data safety:** see below.
- **Government apps:** No. **Financial features:** None. **Health:** None. **News app:** No.
- **Advertising ID:** the app does not use it (no ad or analytics SDKs).

## Data safety

Answer: **"Does your app collect or share any of the required user data types?" → No.**

Checked against the code on branch `android/play-launch`. There are no analytics, crash reporting, ads, accounts or identifiers. Preferences live in `localStorage` and PDFs in IndexedDB, both only on the device. The only permission is `INTERNET`, and the developer runs no server that receives anything from the app.

| Network call | Where | What leaves the device |
|---|---|---|
| Project Gutenberg catalogue (`gutendex.com`) | `src/lib/lookup/gutenberg.ts` | The search text the user typed, sent straight to that public catalogue |
| Internet Archive (`archive.org` search, metadata, download) | `src/lib/lookup/archive-org.ts` | The search text, then the item the user chose |
| Download from a link | `src/lib/download.ts` (CapacitorHttp) | A GET request to the URL the user entered |
| Web search (`deac.online/api/pdf-search`) | `src/lib/lookup/web-search.ts` | Nothing: **disabled in this build** (`WEB_SEARCH_ENABLED = false` in `src/lib/lookup/sources.ts`), so the endpoint is never called |

**Judgment call.** Play defines "collection" as data your app transmits off the device. Its exemptions cover on-device processing and end-to-end encryption, and its "user-initiated" exemption covers *sharing*, not collection. The search text and link requests above go directly from the device to public services the user chose, and the developer never receives them. That makes "No" defensible, and it matches the App Store's "Data Not Collected". The conservative alternative is to declare **App activity → In-app search history**: collected, not shared, processed ephemerally, required for the search feature.

**If web search is ever switched on,** search text would reach a server Dale runs. You'd then have to declare **App activity → In-app search history** (collected, processed ephemerally, not shared, for app functionality) before shipping that build.

**Auto Backup:** `android:allowBackup` is on, so Android's own device backup can include the library in the user's Google account. Play doesn't count that as developer collection; iOS behaves the same with iCloud backup.

## Release

- **Play App Signing:** on. Google holds the app signing key; the repo builds with an upload key that lives outside the repo.
- **Build:** `npm run android:bundle` builds `android/app/build/outputs/bundle/release/app-release.aab`. It needs:
  - JDK 21 and `android/local.properties` with `sdk.dir`.
  - A gitignored `android/keystore.properties` with `storeFile`, `keyAlias` and `keychainService`.
  - The upload-key password, from the macOS Keychain (that service, with account = `keyAlias`) or from `DEEZPDF_KEYSTORE_PASSWORD`.
  - Release builds stop with a clear error if any of this is missing, so an unsigned bundle can't be produced by accident.
- **Track:** internal testing first. Production waits for Dale's go-ahead after testing.
- **Production access:** Worldbuild.io is a *personal* developer account, so Play requires a closed test with **at least 12 opted-in testers for 14 consecutive days** before you can apply for production. The first release (versionCode 16) went to **Closed testing – Alpha** (all 178 countries, email list "DeezPDF closed testers") and was sent for review on 2026-11-08. Play Console app ID: `4975807823192450010`.
- **Play Developer API:** the shell's gcloud credentials get `403 PERMISSION_DENIED` on this app until that account is given access to DeezPDF in Play Console → Users and permissions.
- **Release notes (en-GB):** `First Android release: read PDFs page-by-page, keep a local library on your device, and find free public-domain books.`

## Play Console steps

The Play Developer API can't create apps, so the first release goes through the Console:

1. **Create app** in the Worldbuild.io developer account:
   - App name: `DeezPDF`
   - Default language: English (United Kingdom)
   - App, Free; accept the declarations.
2. **Testing → Internal testing → Testers:** create an email list with the tester accounts, then copy the opt-in link.
3. **Internal testing → Create new release:**
   - Accept Play App Signing (Google-generated key) and upload `app-release.aab`.
   - Paste the release notes.
   - **Start rollout to Internal testing**.
4. **Dashboard → Set up your app:** fill in each section from this file (privacy policy, app access, ads, content rating, target audience, data safety, government apps, financial features, health) and the store listing with the assets in `docs/play-store/assets/`.
5. Promote to production only after testing.
