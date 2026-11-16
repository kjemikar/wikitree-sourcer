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

import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import {
  normalizeViewerMetadata,
  viewerSelectionFromUrl,
} from "../../extension/site/noda/core/noda_viewer_metadata.mjs";
import { normalizeViewerPeople, loadViewerPerson } from "../../extension/site/noda/core/noda_viewer_people.mjs";
import { generalizeData } from "../../extension/site/noda/core/noda_generalize_data.mjs";
import { buildCitation } from "../../extension/site/noda/core/noda_build_citation.mjs";
import { LocalErrorLogger } from "../test_utils/error_log_utils.mjs";
import { writeTestOutputFile } from "../test_utils/ref_file_utils.mjs";
import { compareOrReplaceRefFileWithResult } from "../test_utils/helper_utils.mjs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const fixture = (name = "voss_1899") => read(`./viewer_fixtures/${name}.json`);
const transcriptions = (name = "voss_1899") => read(`./viewer_fixtures/people/${name}.json`);
const records = read("./viewer_fixtures/people/records.json");
const plainText = (html) => new JSDOM(html).window.document.body.textContent;
const image = (name = "voss_1899") => {
  const data = fixture(name);
  return normalizeViewerMetadata(viewerSelectionFromUrl(data.url), data, plainText);
};
const person = (id = "pg00000004763653", name = "voss_1899") =>
  normalizeViewerPeople(transcriptions(name))
    .flatMap((group) => group.entries)
    .find((entry) => entry.id === id);
const fetchRecord = async (url) => {
  const record = records[url.split("/").at(-1)];
  assert.ok(record, "Only the chosen fixture record should be fetched");
  return {
    url: record.url,
    html: fs.readFileSync(new URL("./viewer_fixtures/people/" + record.file, import.meta.url), "utf8"),
  };
};
const context = vm.createContext({ URL, console, logDebug() {} });
vm.runInContext(fs.readFileSync("extension/site/noda/browser/noda_extract_data.js", "utf8"), context);
const extractRecord = (html, url) => context.extractData(new JSDOM(html).window.document, url);
async function selectedRecord(id = "pg00000004763653", name = "voss_1899", overrides = {}) {
  const viewer = image(name);
  return loadViewerPerson(
    viewer,
    person(id, name),
    overrides.fetchRecord || fetchRecord,
    overrides.extractRecord || extractRecord,
    overrides.current || (async () => viewer),
    overrides.selected || (() => true)
  );
}

async function runTests(testManager) {
  if (testManager.parameters.testName && !["viewer", "people"].includes(testManager.parameters.testName)) return;
  const logger = new LocalErrorLogger(testManager.results, "noda_viewer_people");
  console.log("=== Starting test : noda_viewer_people ===");
  const tests = {
    groups_people_by_event_and_preserves_distinct_roles() {
      const groups = normalizeViewerPeople(transcriptions());
      assert.equal(groups.length, 27);
      assert.equal(groups.flatMap((group) => group.entries).length, 40);
      assert.equal(person().supported, true);
      const relative = person("pg00000004763654");
      assert.equal(relative.supported, false);
      assert.equal(relative.role, "pårørande");
      const mixed = normalizeViewerPeople(transcriptions("mixed_1792"));
      assert.deepEqual([...new Set(mixed.map((group) => group.type))], ["dp", "in", "vi"]);
      assert.ok(
        mixed.filter((group) => group.type === "in").every((group) => group.entries.every((p) => !p.supported))
      );
      assert.equal(normalizeViewerPeople(transcriptions("voss_1794")).length, 0);
      assert.throws(() => normalizeViewerPeople([{}]), /transcription list/);
    },
    duplicate_names_and_single_events_remain_unambiguous() {
      const entry = {
        event_id: "hg1",
        person_id: "pg1",
        first_name: "Same",
        last_name: "Name",
        role: "avdød",
        event_year: "1899",
        event_date: "03-18",
      };
      const groups = normalizeViewerPeople({ gr: { hg1: [entry, { ...entry, person_id: "pg2" }, entry] } });
      assert.equal(groups.length, 1);
      assert.equal(groups[0].entries.length, 2);
      assert.notEqual(groups[0].entries[0].key, groups[0].entries[1].key);
      assert.equal(groups[0].entries[0].name, groups[0].entries[1].name);
      assert.equal(groups[0].entries[0].date, "1899-03-18");
    },
    async full_record_preserves_death_and_burial_dates_and_entry_number() {
      const ed = await selectedRecord();
      const gd = generalizeData({ extractedData: ed });
      assert.equal(gd.name.forenames, "Kristi");
      assert.equal(gd.eventDate.getDateString(), "18 Mar 1899");
      assert.equal(gd.deathDate.getDateString(), "12 Mar 1899");
      assert.equal(gd.birthDate.getDateString(), "1859");
      const result = buildCitation({
        extractedData: ed,
        generalizedData: gd,
        type: "inline",
        options: testManager.options,
        runDate: new Date("6 May 2021"),
      });
      assert.match(result.sourceReference, /Page: 55/);
      assert.match(result.sourceReference, /Serial no\.: 7/);
      assert.equal(result.sourceReference.split("Page: 55").length - 1, 1);
      assert.match(result.sourceReference, /Protocol: A 22/);
      assert.equal(ed.imageLink, image().imagePageUrl);
    },
    async refuses_relatives_wrong_people_roles_and_images() {
      const viewer = image();
      let requests = 0;
      await assert.rejects(
        loadViewerPerson(
          viewer,
          person("pg00000004763654"),
          async () => {
            requests++;
          },
          extractRecord,
          async () => viewer,
          () => true
        ),
        /role is not supported/
      );
      assert.equal(requests, 0);
      for (const alter of [
        (ed) => {
          ed.permanentId = "pg1";
        },
        (ed) => {
          ed.recordData.Role.textString = "pårørande";
        },
        (ed) => {
          ed.imageLink = "https://goto.digitalarkivet.no/kb1";
        },
      ]) {
        await assert.rejects(
          selectedRecord(undefined, undefined, {
            extractRecord(html, url) {
              const ed = extractRecord(html, url);
              alter(ed);
              return ed;
            },
          }),
          /does not match/
        );
      }
      await assert.rejects(
        selectedRecord(undefined, undefined, {
          fetchRecord: async () => ({ url: "https://example.invalid/en/view/267/pg00000004763653", html: "" }),
        }),
        /chosen person's record/
      );
    },
    async stale_person_or_image_responses_are_rejected() {
      await assert.rejects(selectedRecord(undefined, undefined, { selected: () => false }), /selected person changed/);
      await assert.rejects(
        selectedRecord(undefined, undefined, { current: async () => image("voss_1794") }),
        /image changed/
      );
      await assert.rejects(
        selectedRecord(undefined, undefined, {
          fetchRecord: async () => {
            throw Error("Offline");
          },
        }),
        /Offline/
      );
    },
  };
  const citationCases = [
    ["burial_kristi", "pg00000004763653", "voss_1899"],
    ["baptism_knut", "pd00000017246548", "voss_1888"],
    ["marriage_groom", "pv00000010316329", "mixed_1792"],
    ["marriage_bride", "pv00000010316330", "mixed_1792"],
  ];
  for (const [caseName, id, name] of citationCases)
    tests[caseName] = async () => {
      const ed = await selectedRecord(id, name);
      const gd = generalizeData({ extractedData: ed });
      const original = await fetchRecord(person(id, name).recordUrl);
      const originalGd = generalizeData({ extractedData: extractRecord(original.html, original.url) });
      assert.deepEqual(JSON.parse(JSON.stringify(gd)), JSON.parse(JSON.stringify(originalGd)));
      if (name === "voss_1888") {
        assert.equal(gd.eventDate.getDateString(), "22 Apr 1888");
        assert.equal(gd.birthDate.getDateString(), "4 Mar 1888");
        assert.equal(gd.parents.father.name.name, "Lars Knutsen");
      }
      if (name === "mixed_1792") assert.ok(gd.spouses?.length);
      const output = {};
      const variants = {
        std: {},
        plain: { citation_general_target: "plain" },
        referenceAtEnd: { citation_general_referencePosition: "atEnd" },
        plainReferenceAtEnd: { citation_general_target: "plain", citation_general_referencePosition: "atEnd" },
        permanentId: { citation_noda_linkFormat: "withPermanentId" },
        noImage: { citation_noda_includeImageLink: false },
      };
      for (const [variant, overrides] of Object.entries(variants))
        for (const type of ["inline", "narrative", "source"]) {
          const options = { ...testManager.options, ...overrides };
          const result = buildCitation({
            extractedData: ed,
            generalizedData: gd,
            type,
            options,
            runDate: new Date("6 May 2021"),
          });
          output[variant + "_" + type] = { citation: result.citation, type };
        }
      const testData = { caseName };
      writeTestOutputFile(output, "noda", "viewer_people_citations", testData, logger);
      compareOrReplaceRefFileWithResult(output, "noda", testManager, "viewer_people_citations", testData, logger);
    };
  for (const [caseName, test] of Object.entries(tests)) {
    if (testManager.parameters.testCaseName && testManager.parameters.testCaseName !== caseName) continue;
    testManager.results.totalTestsRun++;
    try {
      await test();
    } catch (error) {
      logger.logError({ caseName }, error.stack);
    }
  }
  console.log((logger.numFailedTests ? "Test failed" : "Test passed") + " (noda_viewer_people).");
}
export { runTests };
