# Combined feature test build

Branch: `integration/all-contributions`

This local integration branch combines the contributor's current Sourcer features.
It is for testing and is not a replacement for the individual contribution branches.
No new PR is opened for this combined branch.

## Included contributions

- Gravminner memorial citations (PR #554) and form-based search (PR #556), already merged into develop.
- NB.no manual newspaper/book citation assistance (PR #555), with URN links and no collection-based prefilling.
- Danish Family Search records, indexed images, citations, households and search (PR #558).
- Independent fix that preserves collection button labels after form rebuilds.

## Load the build

Disable the previous Sourcer test extension while testing this combined version.
Chrome: choose Load unpacked and select:

```
C:\Users\78weikri\OneDrive - Akademiet Norge AS\X_Privat\Slekt\KI-greier\sourcer-all-features\extension
```

Firefox: use Load Temporary Add-on and select:

```
C:\Users\78weikri\OneDrive - Akademiet Norge AS\X_Privat\Slekt\KI-greier\sourcer-all-features\browser_variants\firefox\manifest.json
```

Both folders are ready to load. Refresh existing source tabs after loading.
Use the existing NB and DFS manual-testing notes in this directory. Confirm
Gravminner citations/search and NB/DFS citation generation in the same extension.
Try collecting citations across sites, including rebuilding a manual NB form,
and check that the collecting button keeps its label.

## Verification, 12 November 2026

- NB, DFS and Gravminner test suites pass on the merged branch; reference files unchanged.
- The actual shared-form collection-label check passes all six citation-mode/collecting combinations, with two rebuilds each.
- Firefox build passes; all three site modules match their Chrome sources.
- Firefox lint: zero errors, warnings or notices.
- All four manifests contain NB, Danish Family Search and Gravminner permissions.
- Branch ancestry checks confirm that all fetched contribution heads are included.
- The full project suite was not rerun for this integration. Manual combined-browser testing is pending; Safari runtime testing is unperformed.

## Pinned input revisions

- `upstream/develop`: `450ca3096c5214018f9312c464c78e00ebcfb57f`
- `origin/feat/nb-citation-assistance`: `81de6ec67e36b82cdf6fdc916a9c808b2be1c23a`
- `origin/feat/danish-family-search`: `a2da5e8cd2f1f72f600d547dab6c7f6d8e9deda1`
- `origin/fix/collection-button-label`: `d863f017afff24a184ff114e45df31a7aea2d1b4`
