# Combined feature test build

Branch: `integration/all-contributions`

This integration branch combines the contributor's current Sourcer features for
local testing. Individual contribution branches and PRs remain separate. No PR
is opened for this combined branch, and the picker PR remains held until viewer
PR #563 merges.

## Included contributions

- Current upstream `develop`, including Gravminner, NB.no, and Danish Family Search.
- The independent collection-button label fix.
- Fractional Digitalarkivet household ages (PR #561).
- Digitalarkivet provider attribution (PR #562).
- New Digitalarkivet parish viewer and source metadata (PR #563).
- Selecting supported primary subjects from parish images (prepared separately;
  its upstream PR is not opened yet).

Only this integration branch updates the ten citation reference files where the
independent changes combine: 134 provider-credit insertions were individually
checked to preserve every existing citation character, type, and option variant.
No individual PR branch is rewritten or given these integration expectations.

## Load the build

Disable the previous Sourcer test extension while testing this combined version.
Refresh existing source tabs after loading or reloading the extension.

Chrome: enable Developer mode at `chrome://extensions`, choose **Load unpacked**,
and select:

```
C:\Users\78weikri\OneDrive - Akademiet Norge AS\X_Privat\Slekt\KI-greier\sourcer-all-features\extension
```

Firefox: at `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**
and select:

```
C:\Users\78weikri\OneDrive - Akademiet Norge AS\X_Privat\Slekt\KI-greier\sourcer-all-features\browser_variants\firefox\manifest.json
```

Portable Chrome and Firefox ZIPs, checksums, and build provenance are prepared in:

```
C:\Users\78weikri\OneDrive - Akademiet Norge AS\X_Privat\Slekt\KI-greier\dist\sourcer-all-contributions-2026-11-16
```

The Chrome ZIP can be extracted and its folder loaded unpacked. Firefox can load
the ZIP as a temporary add-on. Both use the project's normal browser manifests;
these are development test builds, not signed store releases.

## Manual test checklist

- On `https://www.digitalarkivet.no/en/census/person/pf01069455000001`, build the
  household table. Jonettha's age must be `20 1/2` and Ane Maria's `9 1/2`.
- Build a legacy record and image citation; confirm provider attribution and
  unchanged record links, dates, and formatting choices.
- Open `https://goto.digitalarkivet.no/kb20060621010324`. Image-only citation is
  the default. Verify protocol A 22, archive reference, repository, and printed
  page 55. Select Kristi Størkssd: burial 18 March 1899, death 12 March, entry 7.
  Related person Nils must have a record link and be disabled for direct citing.
- Check Knut's baptism at `https://goto.digitalarkivet.no/kb20050822020030` and the
  mixed-event page at `https://goto.digitalarkivet.no/kb20070829660260`.
- Change the person or image during loading, return to image-only citation,
  decline record access, and retry a failed load. Old actions must not cite a
  different person or image.
- Check Plain Text, WikiTree, reference-at-end, and citation collection across
  Digitalarkivet, NB, DFS, and Gravminner. Rebuild an NB form and confirm its
  collecting button retains its label.

More detailed checks are in `site_specific_notes/noda.md`, `nb_manual_test.md`, and
`dfs_manual_test.md` in that subdirectory.

## Verification, 16 November 2026

- Digitalarkivet, NB, DFS, and Gravminner focused suites pass.
- Collection-label check passes all six citation-mode/collecting combinations,
  with two rebuilds each.
- Firefox regenerated using `node scripts/build_firefox.js none`.
- Firefox lint: zero errors, warnings, or notices.
- Full repository suite passes on the combined branch.
- Both browser payloads have 1,206 files. All non-manifest files match byte for
  byte; manifest assets and Digitalarkivet imports are present.
- Ancestry checks include all four Digitalarkivet commits. Their individual
  branch tips are unchanged.
- Browser runtime testing remains pending. Windows computer use cannot perform
  these browser checks because URL-policy enforcement is unsupported.

## Pinned input revisions

- `upstream/develop`: `fc1560e`
- `fix/collection-button-label`: `d863f01`
- `fix/noda-household-fractional-ages`: `af37f6e`
- `feat/noda-archive-attribution`: `86247fb`
- `fix/noda-new-parish-viewer`: `264bccc`
- `feat/noda-image-person-selection`: `2c0f437`

The portable builds' `build-info.json` records the complete integration commit,
all input revisions, archive checksums, and verified browser source paths.
