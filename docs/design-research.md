# Redesign notes

## Research and audit

The [frontend design guidance](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) documents repeated generated-design defaults: warm clay accents with serif headings, unnecessary uppercase labels, decorative numerical counters, and rounded cards used without a structural reason. Its writing guidance recommends plain action labels, specific descriptions, and empty/error states that explain the next action. These patterns are design criticism, not a reliable test of whether a website was generated.

The old Teramanga interface repeated these patterns. This was a reading utility, but its text and layout behaved like a promotional landing page.

| Previous treatment                                      | Replacement                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| Large illustrated hero and decorative `01 / 08` counter | Removed                                                      |
| Uppercase labels above every page heading               | Removed                                                      |
| “A little escape. A whole new world.”                   | Removed                                                      |
| “All your stories. One quiet corner of the internet.”   | Removed                                                      |
| “Your next little escape” / “The world can wait”        | Removed                                                      |
| “Read your way”                                         | “Reader settings”                                            |
| “Another chapter, another world”                        | “Chapter completed”                                          |
| “Made for the love of stories” footer                   | Removed                                                      |
| Warm peach buttons and green backgrounds                | Neutral charcoal panels and grey controls                    |
| Prefilled fictional manga and generated artwork         | Empty initial library; actual catalogs and installed sources |

The revised layout uses system typography, sentence-case labels, a fixed navigation rail, a compact toolbar, actual cover images without added title overlays, and plain chapter rows. Palette: page `#19191c`, navigation `#202023`, panels `#25252b`, borders `#333338`, primary text `#ededf0`, secondary text `#a1a1aa`. Reader light/sepia preferences remain available.

## Extension research

- [Keiyoushi's current repository instructions](https://github.com/keiyoushi/extensions) use `index.pb`. The old `index.min.json` returns an “Outdated App” placeholder and is not the working catalog.
- [Suwayomi Server](https://github.com/Suwayomi/Suwayomi-Server) runs Mihon/Tachiyomi extensions on the JVM. It handles APK execution, network requests, and authenticated image delivery; the frontend uses its GraphQL API.
- Verified the live GraphQL schema against version `v2.4.2366`, loaded 1,439 Keiyoushi extensions, installed the native MangaDex APK, searched its English source, loaded 134 chapters for a title, and fetched an actual chapter image through the server.
- Browser integration tests cover authentication, exact 64-bit source IDs, repository normalization, installation, reading, backups, and restoring after server database IDs change.
