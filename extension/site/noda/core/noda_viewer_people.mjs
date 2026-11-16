/*
MIT License

Copyright (c) 2020 Robert M Pavey

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { assertViewerSelection, sameViewerSelection, viewerSelectionFromUrl } from "./noda_viewer_metadata.mjs";

const primaryRoles = { dp: ["barn"], gr: ["avdød"], vi: ["brur", "brudgom"] };
const personPrefixes = { dp: "pd", gr: "pg", vi: "pv" };
const eventNames = { dp: "Births and baptisms", gr: "Burials", vi: "Marriages" };
const text = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

function normalizeViewerPeople(data) {
  if (Array.isArray(data) && data.length === 0) return [];
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("Digitalarkivet did not return a transcription list.");
  const groups = [];
  for (const [type, events] of Object.entries(data)) {
    if (!events || typeof events !== "object" || Array.isArray(events)) continue;
    for (const [eventId, people] of Object.entries(events)) {
      if (!Array.isArray(people)) continue;
      const entries = [];
      const seen = new Set();
      for (const person of people) {
        const id = text(person.person_id);
        const role = text(person.role);
        if (!/^p[a-z]\d+$/.test(id) || person.event_id !== eventId) continue;
        const key = `${type}:${eventId}:${id}:${role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const year = /^\d{4}$/.test(text(person.event_year)) ? person.event_year : "";
        const date = /^\d{2}-\d{2}$/.test(text(person.event_date)) ? person.event_date : "";
        entries.push({
          key,
          id,
          role,
          type,
          eventId,
          name: [text(person.first_name), text(person.last_name)].filter(Boolean).join(" ") || id,
          date: [year, date].filter(Boolean).join("-"),
          supported: Boolean(primaryRoles[type]?.includes(role) && id.startsWith(personPrefixes[type])),
          recordUrl: `https://www.digitalarkivet.no/en/${id}`,
        });
      }
      if (entries.length)
        groups.push({
          eventId,
          type,
          label: [eventNames[type] || type, entries[0].date].filter(Boolean).join(" — "),
          entries,
        });
    }
  }
  return groups;
}

function sameRecordImage(record, viewer) {
  try {
    const url = new URL(record.imageLink);
    if (sameViewerSelection(viewer, viewerSelectionFromUrl(url.href))) return true;
    return Boolean(
      viewer.permanentId &&
        ["https://www.digitalarkivet.no", "https://media.digitalarkivet.no", "https://goto.digitalarkivet.no"].includes(
          url.origin
        ) &&
        url.pathname.split("/").at(-1) === viewer.permanentId
    );
  } catch {
    return false;
  }
}

async function loadViewerPerson(viewer, person, fetchRecord, extractRecord, getCurrentSelection, isStillSelected) {
  if (
    !primaryRoles[person.type]?.includes(person.role) ||
    !new RegExp(`^${personPrefixes[person.type]}\\d+$`).test(person.id)
  )
    throw new Error("Open this person's record directly; their role is not supported by the image picker.");
  const url = `https://www.digitalarkivet.no/en/${person.id}`;
  const response = await fetchRecord(url);
  await assertViewerSelection(viewer, getCurrentSelection);
  if (!isStillSelected()) throw new Error("The selected person changed. Choose the intended person again.");
  const address = new URL(response.url);
  if (
    address.origin !== "https://www.digitalarkivet.no" ||
    !new RegExp(`^/en/view/\\d+/${person.id}/?$`).test(address.pathname)
  )
    throw new Error("Digitalarkivet did not return the chosen person's record.");
  const record = extractRecord(response.html, response.url);
  if (
    !record.success ||
    record.pageType !== "record" ||
    record.permanentId !== person.id ||
    record.recordData?.Role?.textString !== person.role ||
    !sameRecordImage(record, viewer)
  )
    throw new Error("The chosen record's person, role, or image does not match. Open the record directly to check it.");
  return {
    ...record,
    imageLink: viewer.imagePageUrl,
    viewerMetadata: viewer.viewerMetadata,
    viewerContext: { sourceId: viewer.sourceId, imageUuid: viewer.imageUuid, url: viewer.url },
  };
}

export { normalizeViewerPeople, loadViewerPerson };
