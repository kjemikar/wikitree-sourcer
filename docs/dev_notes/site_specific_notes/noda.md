# Digitalarkivet parish viewer

The new `nye.digitalarkivet.no/source/<sourceId>/parish/<imageUuid>` viewer is
handled separately from legacy record and `media.digitalarkivet.no` image pages.
Content extraction identifies the URL; the popup loads public source and image
JSON through the existing background fetch helper and optional site permissions.
It does not inspect private application state, execute page scripts, or download
image pixels.

The metadata normalizer checks the source manifest ID and selected canvas, and
the file-info image UUID. Pagination is keyed by the UUID, not its array position.
Printed page, permanent image ID, source ID, and canvas UUID are distinct. The
register period and page-year describe the source; they are not personal events.
English metadata is preferred with Norwegian fallback. Inert metadata markup is
converted to plain text.

An optional request failure leaves verified metadata available; if all requests
fail, the build form explains that only the exact viewer link can be cited. A
wrong-source/image response is rejected. Identity is checked after loading and
again through the build form's asynchronous hook before generating a citation.
This also protects citation collection after navigation without reload.

New viewer citations use the provided permanent ID at `goto.digitalarkivet.no`;
legacy link handling is unchanged. Provider attribution is separate from the
actual holding institution. No generic provider credit is added by this change.

## Verification

Run `node scripts/run_test.js noda viewer` for viewer metadata, citation snapshots,
and popup behavior tests, then `node scripts/run_test.js noda` for legacy coverage.
The full repository suite is `node scripts/run_test.js`.

Manual Chrome/Firefox checks still required:

- Open each URL in `unit_tests/noda/viewer_fixtures/*.json` and build WikiTree and
  Plain Text citations. Verify source title, protocol, holding institution, page,
  stable link, and references-at-end formatting.
- Navigate to another image without reloading while Sourcer is open. Old actions
  must not generate a citation for the previous image.
- Test a source/index-only page, unavailable metadata, and an untranscribed page.
- Recheck legacy record pages and the legacy census-image viewer.

Windows computer use currently stops at the browser URL-policy restriction, so
browser UI verification has not been completed by the contributor.

## Selecting a transcribed person

The popup loads `/api/transcription-link?uuid=<imageUuid>` and groups people by
event, showing date and role. The initial selection is always **Image citation
only**, even when there is a single entry. Direct record actions support only
`dp/barn`, `gr/avdød`, and `vi/brur` or `vi/brudgom`. Relatives, witnesses, and other
types retain record links. A page's people must not become a household.

Only the chosen person's canonical English record page is fetched. The existing
extractor is loaded into the popup, as in the Ancestry linked-record integration;
HTML is parsed without executing scripts. The returned person ID, role, and image
association must match before record actions become available. Personal facts
come from the full record, never from the abbreviated picker list. Image metadata
adds archive/protocol context without duplicating the record's page or entry.

The transcription endpoint returns an empty array for untranscribed images.
It is fetched in the popup because the shared background JSON helper accepts
objects only. Both image metadata and record requests use existing optional
Digitalarkivet permissions. Selection and response tokens last only for the
current popup; no person choice is persisted. Late responses cannot overwrite a
newer choice, and failed/declined record loads leave image citation plus retry and
record links available.

Run `node scripts/run_test.js noda people` for selection, full-record, citation,
and popup interaction checks. `node scripts/run_test.js noda viewer` covers both
viewer and person-picker behavior.

Additional manual checks:

- Select Kristi Størkssd on the Voss 1899 image: burial 18 March, death 12 March,
  page 55, entry 7. Related person Nils must be disabled for direct citation.
- Select Knut on the Voss 1888 image: baptism 22 April, birth 4 March, parents
  preserved. Select each spouse on the mixed 1792 page and confirm reciprocal
  spouse information.
- Change selection while a record loads, return to image-only citation, deny
  record access, retry a failed request, and navigate to another image.
