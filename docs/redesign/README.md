# DeezPDF friendly refresh (Nov 2026)

DeezPDF moves from a dark-only "cyberpunk" look to the playful house style in
Dale's recent apps ("Duolingo meets kurzgesagt"). It keeps its own identity:
the cyan/sky brand colour, the wordmark, the app icon and a small page character
drawn in code. Every feature still works the same way. The few behaviour changes
are listed below.

## Where the style comes from

There is no shared DESIGN.md or token file across the apps. The tokens were
read from the most recent apps' Swift design systems:

| Source | What it gave |
|---|---|
| GoldenMean `GoldenMean/DesignSystem/Theme.swift`, `Components.swift` | Muted-text colour (AA-checked), radii (16 / 22), 4 pt "lip", 18 pt page padding, Reduce Motion habits, dark ink on bright fills |
| Pawnly `Pawnly/Design/Theme.swift`, `ColorTheme.swift` | Sky `#1CB0F6` and its lip `#1899D6`, tints, light neutrals, slate dark mode `#131F24` |
| Goggly `WeAreVR/Design/Theme.swift`, `CONTENT_GUIDE.md` | SF Rounded heavy everywhere, springs, microcopy tone ("like a very clever friend") |
| HabitBalance `Shared/Design/Palette.swift`, `Illustrations.swift`, `docs/BRIEF.md` | Flat illustration rules: no outlines, rounded shapes, soft orbs, stars |
| Orbit `Shared/Theme.swift` | Checked, but not followed: its frosted-glass look is a productivity variant, not the house default |

## Style spec (as implemented)

Every value lives in [`src/styles/tokens.css`](../../src/styles/tokens.css).
[`src/styles/app.css`](../../src/styles/app.css) only references tokens.

- **Colour**
  - Brand sky `#1CB0F6` with lip `#1899D6`. Accents: pink `#FF86D0` (DeezPDF's old magenta, softened) and gold `#FFC800`.
  - Light mode: white page and cards, text `#3C3C3C`, muted text `#5F666D`.
  - Dark mode: deep slate `#131F24` with cards `#1C2B33`, text `#F1F7FB`, muted text `#A5B5C1`.
  - Text on sky uses dark ink `#0B2A3D` (6.1:1), because white on sky is only 2.4:1.
  - When sky is used as text, it becomes `--primary-ink` (`#0870A6` light, `#5CCBFF` dark).
  - Every text pair passes WCAG 2.2 AA in both modes. A `prefers-contrast: more` variant darkens muted text and borders.
- **Type**
  - System only: `ui-rounded` (SF Pro Rounded) for the interface and `ui-serif` (New York) for text-mode reading.
  - Weights: 800 for headings and buttons, 700 for labels, 600 for supporting text, 500 for body.
  - Buttons are uppercase with 0.04em tracking.
  - `html { font: -apple-system-body }` ties `rem` to iOS Dynamic Type.
  - The Orbitron web font is gone, so the app no longer downloads a font from Google.
- **Shape and depth**
  - Radii: 12 (chips and icon buttons), 16 (buttons and inputs), 22 (cards), pill.
  - The house signature is a solid 4 pt "lip" under buttons and cards. Pressing a button sinks it into its lip. There are no blurred shadows, glass or glow.
- **Layout**
  - 18 pt page gutter and a 2–24 pt spacing scale.
  - Buttons are 52 pt tall, and every target is at least 44 pt.
- **Illustration and icons**
  - A "page buddy" (a page with a folded corner) drawn in code ([`src/components/illustration.ts`](../../src/components/illustration.ts)), in four moods: happy, reading, curious and sad.
  - It sits on soft orbs with twinkling stars, uses flat fills with no outlines, and is hidden from VoiceOver.
  - Icons are rounded 2.25-stroke inline SVGs ([`src/lib/symbols.ts`](../../src/lib/symbols.ts)). They replace the Unicode glyphs ◂ ⊕ ⇩ 𝔄 ⎔ ⊗ that VoiceOver read out.
- **Motion**
  - Snappy and bouncy springs, approximated with cubic-béziers: cards pop in (staggered, capped at 8), toasts drop in, the illustration floats, and the loading dots hop.
  - With Reduce Motion, everything collapses to 1 ms with no loops or press movement. State changes still happen.
- **Microcopy**
  - Warm, short, second person, and never shaming.
  - Examples: "Your shelf is empty", "What do you feel like reading?", "Looking through the stacks…", "We couldn't open this one".
  - Error codes stay in the log and debug panel. People see plain language.

## Usability fixes (from the UX audit)

1. **Primary actions have words.**
   - On iPhone, "Add PDF" / "From a link", "Search" and the preview "Add" were bare symbols (⊕ ⇩ ⌕). They are now labelled chunky buttons.
   - Each Find Online result has labelled **Preview** and **Add** buttons, where it used to have the glyphs ◧ / ⊕.
2. **The reader is easy to drive.**
   - Back is "‹ Library" and no longer the same ◂ as Previous page.
   - Previous / Next are large buttons at the bottom, within thumb reach, around a page counter.
   - The document title is visible.
   - The duplicated top safe-area gap is gone.
3. **Hidden controls stay hidden.** `[hidden]` was being overridden, so the font and theme controls showed up in page mode, where they did nothing.
4. **Empty and error states have next steps.**
   - Empty shelf: an illustration plus **Add a PDF** and **Find a free book**.
   - No matches: **Show everything**, which clears the search and filter.
   - Results hidden by the source filter: **Show all sources**.
   - Reader error: **Try again** and **Back to library**.
5. **VoiceOver**
   - Library cards are announced as buttons ("Open …"), and the Add PDF control has one clean name.
   - Toasts are live regions (`role=alert` for errors).
   - The canvas is labelled "Page X of Y", and the page counter says "Page 3 of 12".
   - The text-mode menu item is a checkbox with a ✓.
   - The whole page is no longer re-announced on every page turn.
   - The source chips use `aria-pressed`.
6. **Dynamic Type works** through `-apple-system-body`. Layouts wrap (auto-fit grids, clamped titles); see the large-text screenshots.
7. **Contrast:** muted text, error text and badges all failed AA before. All now pass, in light and dark.
8. **Touch targets:** chips, the preview Add button, the rename field, the debug close button and the footer links were all under 44 pt. All are now at least 44 pt.
9. **Light mode:** the app now follows the system appearance. The status bar, theme-color and PWA manifest follow it too.
10. **Less clutter:** seven explanatory lines above the content have become one line per tab. The footer is no longer fixed over the last card; it scrolls with the content.
11. **Fresh-eyes review fixes.**
    - Titles containing quotes broke `aria-label`s and could inject attributes. All three views and the debug panel now share one `escapeHtml` that also escapes quotes.
    - Card names now include their status ("Open X, New, 16.6 KB"). The rename field is no longer nested inside a `role=button`.
    - The page behind the link dialog is `inert`.
    - The focus ring and selected tab/chip edges use `--focus-ring` / `--selected-edge`, which pass 3:1 (sky alone was only 2.4:1).
    - Download errors say why they failed (private, gone, offline, not a PDF), and a save you cancelled isn't shown as an error.
    - Arrow keys don't turn pages while the options menu is open. Focus doesn't drop to the page when Next or Previous disables itself.
    - Adding from a preview shows a confirmation toast.
    - At large text sizes the reader header shows icons only (container query), so the title stays readable.
    - The source chips wrap instead of hiding "Web" off-screen.
    - The logo has a ring in dark mode.
    - When the shelf is empty, only the empty-state actions show.
12. **The keyboard no longer hides things.**
    - The "Add from a link" sheet is anchored to the top on phones; at the bottom, the iOS keyboard covered its buttons.
    - The Find tab no longer pops the keyboard over its welcome state on touch devices.

## Behaviour changes (kept small)

| Change | Why |
|---|---|
| **iOS 27 scene lifecycle.** Added `SceneDelegate.swift` and `UIApplicationSceneManifest` to Info.plist; the window still comes from `Main.storyboard`. | Builds from the current Xcode/iOS 27 SDK trapped at launch (`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). Without this, no new build runs at all. |
| **PDFs are stored as `ArrayBuffer`, not `Blob`.** Legacy Blob records are moved to bytes the first time they're read. A record that can no longer be read shows a clear "remove and add it again" message. See [`src/lib/pdf-data.ts`](../../src/lib/pdf-data.ts) and its test. | In the Capacitor WKWebView, IndexedDB Blobs threw `NotFoundError: The object can not be found here.` from the second read in a session, so **reopening any PDF failed** with ERR-PDF-001. |
| **Internet Archive search skips lending-library items** (`AND NOT access-restricted-item:true`). Test in `tests/archive-org.test.ts`. | Those items return HTTP 401 to anonymous downloads, so Preview and Add failed on most results. |
| **Find Online keeps your last search** (query, results, filter, added items) for the session. | "Back to results" from a preview used to wipe the search. |
| After **Add** in a preview, you land on **My Library**. | So you can see the book you just added. |
| The web-search notice is now actually shown, in plain words. | A bug hid it immediately after showing it. Note: `https://deac.online/api/pdf-search` currently returns **404**, so "Web" never returns results. |
| "Try another search" puts you back in the search field. It no longer re-runs the same failing query. | Re-running the same query just failed again. |
| No-match search resets via **Show everything**. | It replaces a dead end. |
| Reader error has **Try again**. Adding from a preview shows "Adding…", and a failure shows an error toast instead of being swallowed. | Missing feedback. |
| Views receive a `remove` event when swapped out. | The reader's cleanup listened for it, but it was never fired, which leaked listeners and left the old document title behind. |
| Toast timers reset properly. The link dialog closes on Escape from anywhere inside it and returns focus where it was. | Accessibility and polish. |

## Screenshots

iPhone 17 simulator (iOS 27), saved at 660 px wide. The old app was dark-only,
so its "light" shots look the same as its dark ones.

| Screen | Before | After (light) | After (dark) |
|---|---|---|---|
| Library | [before](before/library-light.png) | [light](after/library-light.png) | [dark](after/library-dark.png) |
| Empty library | [before](before/library-empty-light.png) | [light](after/library-empty-light.png) | [dark](after/library-empty-dark.png) |
| Add from a link | [before](before/download-dialog-dark.png) | [light](after/link-dialog-light.png) | [dark](after/link-dialog-dark.png) |
| Reader | [before](before/reader-light.png) | [light](after/reader-light.png) | [dark](after/reader-dark.png) |
| Reading options | [before](before/reader-menu-light.png) | [light (text mode on)](after/reader-menu-textmode-light.png) | [dark](after/reader-menu-dark.png) · [text mode on](after/reader-menu-textmode-dark.png) |
| Text mode | (couldn't capture, see note) | [light](after/reader-textmode-light.png) | [dark](after/reader-textmode-dark.png) · [dark page](after/reader-textmode-darkpage-dark.png) |
| Reader error | [before](before/reader-error-light.png) | [light](after/reader-error-light.png) | [dark](after/reader-error-dark.png) |
| Find Online, start | [before](before/find-empty-dark.png) | [light](after/find-empty-light.png) | [dark](after/find-empty-dark.png) |
| Searching | [before](before/searching-light.png) | — | [dark](after/searching-dark.png) |
| Results | [before](before/find-results-light.png) | [light](after/find-results-light.png) | [dark](after/find-results-dark.png) |
| No results | — | [light](after/find-noresults-light.png) | [dark](after/find-noresults-dark.png) |
| Filtered to nothing | — | [light](after/find-filtered-empty-light.png) | — |
| Preview | — | [light](after/preview-light.png) | [dark](after/preview-dark.png) |
| Toast, remove confirm | — | [toast](after/toast-added-light.png) · [confirm](after/remove-confirm-light.png) | — |
| Large text (AX Large) | — | [library](after/library-largetext-light.png) · [reader](after/reader-largetext-light.png) · [find](after/find-largetext-light.png) | — |

Note: the "before" reader error is the reopen bug above. In the old build,
opening any PDF a second time showed it, so text mode couldn't be captured.

## Not done / follow-ups

- **App icon:** kept as it is (black squircle with white stacked pages). It still fits next to the new UI, but it's the one dark, flat element left. A possible later refresh: the same stacked pages in white on a sky `#1CB0F6` → `#3DC2FF` gradient. This is a proposal only; nothing was swapped.
- **Web search:** the production endpoint `deac.online/api/pdf-search` returns 404. Either deploy it or hide the "Web" chip.
- **App Store screenshots** still show the old look. Update them when this ships.
- Adding from a preview doesn't mark the result as "Added" in the results list. The library is correct.
- The Capacitor packages are on 8.4. 8.5 adds `SceneDelegateProxy`, which would let `SceneDelegate` forward URL opens through Capacitor's own helper.
- The viewport still sets `user-scalable=no`, because the reader has its own pinch-zoom. Text scales with Dynamic Type instead. Revisit this for the desktop/PWA build.
- Haptics: the house style uses light haptics on press. That needs `@capacitor/haptics`, a new dependency, so it wasn't added.
