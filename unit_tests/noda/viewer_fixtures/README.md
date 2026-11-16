# New parish viewer fixtures

Public responses captured on 16 November 2026 from the endpoints used by the
Digitalarkivet viewer. Each JSON contains the source manifest, selected image's
file information, and its pagination entry. Other canvases and pagination
entries were removed; no image pixels are included. The HTML files are focused
shells, since extraction uses the URL and the popup loads metadata separately.

- `voss_1794`: the image linked in #453, printed page 131, no transcription list.
- `voss_1899`: the image linked by #453's Kristi Størkssd record, page 55.
- `voss_1888`: Knut's baptism page 29, also covered by legacy tests.
- `mixed_1792`: chronological page 41, containing multiple event types.

The JSON's `url` records the exact viewer address. Source IDs, image UUIDs,
permanent image IDs, and printed pages are distinct identifiers.

`people/` contains the full public transcription-list responses for these four
images and focused English person-record HTML, captured on the same date.
`people/records.json` records final record URLs and file names. Record captures
retain breadcrumbs and the article; scripts, styles, and unrelated site chrome
were removed. They include the primary burial subject, a related person used for
negative checks, a baptism child, and both spouses on the mixed chronological
page. No image pixels or private account data are included.
