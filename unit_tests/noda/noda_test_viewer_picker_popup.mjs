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
  viewerSelectionFromUrl,
  loadViewerMetadata,
  assertViewerSelection,
} from "../../extension/site/noda/core/noda_viewer_metadata.mjs";
import { normalizeViewerPeople, loadViewerPerson } from "../../extension/site/noda/core/noda_viewer_people.mjs";
import { generalizeData } from "../../extension/site/noda/core/noda_generalize_data.mjs";
import { buildCitation } from "../../extension/site/noda/core/noda_build_citation.mjs";
import { buildHouseholdTable } from "../../extension/base/core/table_builder.mjs";
import { LocalErrorLogger } from "../test_utils/error_log_utils.mjs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const records = read("./viewer_fixtures/people/records.json");
const popupCode = fs
  .readFileSync("extension/site/noda/browser/noda_popup.mjs", "utf8")
  .replace(/^import[\s\S]*?;\s*$/gm, "");
const pickerCode = fs
  .readFileSync("extension/site/noda/browser/noda_viewer_person_picker.mjs", "utf8")
  .replace(/^export.*$/gm, "");
function harness(options, name = "voss_1899", { recordAllowed = true, listOffline = false } = {}) {
  const fixture = read(`./viewer_fixtures/${name}.json`);
  const people = read(`./viewer_fixtures/people/${name}.json`);
  const dom = new JSDOM('<!doctype html><nav id="menu"></nav>');
  const document = dom.window.document;
  const state = {
    url: fixture.url,
    requests: [],
    recordRequests: [],
    built: [],
    warnings: [],
    waits: new Map(),
    menus: [],
  };
  const environment = {
    document,
    URL,
    DOMParser: dom.window.DOMParser,
    console,
    logDebug() {},
    setTimeout,
    clearTimeout,
    AbortController,
    viewerSelectionFromUrl,
    assertViewerSelection,
    normalizeViewerPeople,
    loadViewerPerson,
    loadViewerMetadata: (selection, fetchJson, current) =>
      loadViewerMetadata(selection, fetchJson, current, (html) => new JSDOM(html).window.document.body.textContent),
    generalizeData,
    buildCitation,
    buildHouseholdTable,
    initPopup() {},
    checkPermissionForSite: async () => true,
    checkPermissionForSiteFromUrl: async () => recordAllowed,
    displayBusyMessage() {},
    displayMessageWithIcon: async (...args) => state.warnings.push(args.join(" ")),
    setupSimplePopupMenu: async (input) => {
      state.input = input;
      state.menus.push(input);
      const root = document.getElementById("menu");
      root.replaceChildren();
      if (input.buildCitationFunction) {
        const button = document.createElement("button");
        button.id = "build";
        button.onclick = async () => {
          await input.regeneralizeFunction?.();
          const result = input.buildCitationFunction({
            extractedData: input.extractedData,
            generalizedData: generalizeData({ extractedData: input.extractedData }),
            options,
            type: "inline",
            runDate: new Date("6 May 2021"),
          });
          state.built.push(result);
        };
        root.append(button);
      }
      input.customMenuFunction?.({ list: root });
    },
    chrome: {
      tabs: {
        get: async () => {
          await state.beforeTabRead?.();
          return { url: state.url };
        },
      },
      runtime: {
        sendMessage(request, callback) {
          state.requests.push(request.fetchUrl);
          const json = request.fetchUrl.includes("/manifest/")
            ? fixture.manifest
            : request.fetchUrl.includes("/file-info/")
            ? fixture.fileInfo
            : fixture.pagination;
          callback({ success: true, json });
        },
      },
    },
    fetch: async (url) => {
      if (url.includes("/api/transcription-link")) {
        if (listOffline) throw new Error("Offline");
        return { ok: true, json: async () => people };
      }
      state.recordRequests.push(url);
      const id = url.split("/").at(-1);
      await state.waits.get(id);
      if (state.failRecord) return { ok: false };
      const data = records[id];
      assert.ok(data, "Only the chosen record should be fetched");
      return {
        ok: true,
        url: data.url,
        text: async () => fs.readFileSync(new URL("./viewer_fixtures/people/" + data.file, import.meta.url), "utf8"),
      };
    },
  };
  const context = vm.createContext(environment);
  vm.runInContext(fs.readFileSync("extension/site/noda/browser/noda_extract_data.js", "utf8"), context);
  vm.runInContext(pickerCode, context);
  vm.runInContext(popupCode, context);
  return {
    state,
    document,
    show: () =>
      context.setupNodaPopupMenu({ ...viewerSelectionFromUrl(fixture.url), newViewer: true, pageType: "image" }, 1),
    async choose(id) {
      const entry = normalizeViewerPeople(people)
        .flatMap((group) => group.entries)
        .find((p) => p.id === id);
      const select = document.getElementById("noda-viewer-person");
      select.value = id ? entry.key : "";
      await select.onchange();
    },
  };
}
async function runTests(testManager) {
  if (testManager.parameters.testName && !["viewer", "people"].includes(testManager.parameters.testName)) return;
  const logger = new LocalErrorLogger(testManager.results, "noda_viewer_picker_popup");
  const tests = {
    async picker_defaults_to_image_and_fetches_only_the_chosen_subject() {
      const ui = harness(testManager.options);
      await ui.show();
      assert.equal(ui.document.querySelector("select").value, "");
      assert.equal(ui.state.recordRequests.length, 0);
      assert.equal(ui.state.input.extractedData.pageType, "image");
      await ui.choose("pg00000004763653");
      assert.deepEqual(ui.state.recordRequests, ["https://www.digitalarkivet.no/en/pg00000004763653"]);
      assert.equal(ui.state.input.extractedData.permanentId, "pg00000004763653");
      assert.equal(ui.state.input.doNotIncludeSearch, false);
      await ui.document.getElementById("build").onclick();
      assert.match(ui.state.built[0].citation, /Kristi/);
      assert.match(ui.state.built[0].citation, /12 Mar 1899/);
      assert.match(ui.state.built[0].citation, /18 Mar 1899/);
      assert.match(ui.state.built[0].sourceReference, /Serial no\.: 7/);
      const oldGuard = ui.state.input.regeneralizeFunction;
      await ui.choose("");
      assert.equal(ui.state.input.extractedData.pageType, "image");
      await assert.rejects(oldGuard(), /selected person changed/);
    },
    async relative_is_disabled_but_has_a_record_link() {
      const ui = harness(testManager.options);
      await ui.show();
      const option = [...ui.document.querySelectorAll("option")].find((node) =>
        node.textContent.includes("Nils Pedersen")
      );
      assert.equal(option.disabled, true);
      assert.ok(ui.document.querySelector('a[href="https://www.digitalarkivet.no/en/pg00000004763654"]'));
      await ui.choose("pg00000004763654");
      assert.equal(ui.state.recordRequests.length, 0);
      assert.equal(ui.state.input.extractedData.pageType, "image");
    },
    async failed_record_or_permission_retains_image_citation_and_retry() {
      for (const recordAllowed of [true, false]) {
        const ui = harness(testManager.options, "voss_1899", { recordAllowed });
        await ui.show();
        ui.state.failRecord = true;
        await ui.choose("pg00000004763653");
        assert.equal(ui.state.input.extractedData.pageType, "image");
        assert.ok(
          [...ui.document.querySelectorAll("button")].some((button) => button.textContent === "Retry chosen record")
        );
        assert.ok(ui.document.querySelector('a[href="https://www.digitalarkivet.no/en/pg00000004763653"]'));
        assert.equal(ui.state.recordRequests.length, recordAllowed ? 1 : 0);
        if (recordAllowed) {
          ui.state.failRecord = false;
          await [...ui.document.querySelectorAll("button")]
            .find((button) => button.textContent === "Retry chosen record")
            .onclick();
          assert.equal(ui.state.input.extractedData.permanentId, "pg00000004763653");
        }
      }
    },
    async empty_or_failed_transcription_list_keeps_image_citation() {
      for (const [name, options] of [
        ["voss_1794", {}],
        ["voss_1899", { listOffline: true }],
      ]) {
        const ui = harness(testManager.options, name, options);
        await ui.show();
        assert.equal(ui.document.querySelectorAll("option").length, 1);
        assert.equal(ui.document.querySelector("select").value, "");
        assert.equal(ui.state.input.extractedData.pageType, "image");
        assert.ok(ui.document.getElementById("build"));
      }
    },
    async late_record_response_cannot_replace_a_newer_choice() {
      const ui = harness(testManager.options, "mixed_1792");
      await ui.show();
      let release;
      ui.state.waits.set(
        "pv00000010316329",
        new Promise((resolve) => {
          release = resolve;
        })
      );
      const pending = ui.choose("pv00000010316329");
      await new Promise(setImmediate);
      assert.equal(ui.document.getElementById("build"), null);
      await ui.choose("pv00000010316330");
      release();
      await pending;
      assert.equal(ui.state.input.extractedData.permanentId, "pv00000010316330");
      assert.equal(ui.state.warnings.length, 0);
    },
    async navigation_while_loading_prevents_person_actions() {
      const ui = harness(testManager.options);
      await ui.show();
      let release;
      ui.state.waits.set(
        "pg00000004763653",
        new Promise((resolve) => {
          release = resolve;
        })
      );
      const pending = ui.choose("pg00000004763653");
      await new Promise(setImmediate);
      ui.state.url = "https://nye.digitalarkivet.no/source/11769";
      release();
      await pending;
      assert.equal(ui.state.input.buildCitationFunction, undefined);
      assert.match(ui.state.warnings[0], /image changed/);
      assert.equal(ui.state.built.length, 0);
    },
    async late_display_check_cannot_adopt_a_newer_selection_token() {
      const ui = harness(testManager.options, "mixed_1792");
      await ui.show();
      let reads = 0;
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      ui.state.beforeTabRead = async () => {
        if (ui.state.recordRequests.length && ++reads === 2) await gate;
      };
      const pending = ui.choose("pv00000010316329");
      await new Promise(setImmediate);
      await ui.choose("pv00000010316330");
      release();
      await pending;
      assert.equal(ui.state.input.extractedData.permanentId, "pv00000010316330");
      await ui.document.getElementById("build").onclick();
      assert.match(ui.state.built[0].citation, /Ragnil/);
    },
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
  console.log((logger.numFailedTests ? "Test failed" : "Test passed") + " (noda_viewer_picker_popup).");
}
export { runTests };
