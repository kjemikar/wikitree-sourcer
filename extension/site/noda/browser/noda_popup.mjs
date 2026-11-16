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

import { setupSimplePopupMenu } from "/base/browser/popup/popup_simple_base.mjs";
import { initPopup } from "/base/browser/popup/popup_init.mjs";
import { generalizeData } from "../core/noda_generalize_data.mjs";
import { buildCitation } from "../core/noda_build_citation.mjs";
import { buildHouseholdTable } from "/base/core/table_builder.mjs";
import { checkPermissionForSite, checkPermissionForSiteFromUrl } from "/base/browser/popup/popup_permissions.mjs";
import { displayMessageWithIcon, displayBusyMessage } from "/base/browser/popup/popup_menu_building.mjs";
import { viewerSelectionFromUrl, loadViewerMetadata, assertViewerSelection } from "../core/noda_viewer_metadata.mjs";
import { normalizeViewerPeople, loadViewerPerson } from "../core/noda_viewer_people.mjs";
import { addViewerPersonPicker } from "./noda_viewer_person_picker.mjs";

function fetchViewerJson(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Digitalarkivet metadata took too long to load.")), 15000);
    chrome.runtime.sendMessage(
      { type: "doFetchJson", fetchUrl: url, fetchOptions: { credentials: "omit" } },
      (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError || !response?.success)
          reject(new Error("Digitalarkivet metadata could not be loaded."));
        else resolve(response.json);
      }
    );
  });
}

async function fetchPersonRecord(url) {
  if (
    !(await checkPermissionForSiteFromUrl(url, {
      reason: "Read the chosen person's full Digitalarkivet record.",
      allowSkip: true,
      needsPopupDisplayed: true,
    }))
  )
    throw new Error("Record access was not granted. You can still cite the image or open the record below.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { credentials: "omit", signal: controller.signal });
    if (!response.ok) throw new Error("The chosen record could not be loaded. Try again or open it below.");
    return { url: response.url, html: await response.text() };
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error("The chosen record took too long to load. Try again or open it below.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function setupViewerPersonMenu(viewer, currentSelection) {
  let groups = [];
  let unavailable = false;
  try {
    // This endpoint uses [] for an untranscribed image; the shared background
    // JSON helper only accepts objects. Fetch it here under the same permission.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`https://nye.digitalarkivet.no/api/transcription-link?uuid=${viewer.imageUuid}`, {
        credentials: "omit",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Transcriptions unavailable");
      groups = normalizeViewerPeople(await response.json());
    } finally {
      clearTimeout(timer);
    }
  } catch {
    unavailable = true;
  }
  await assertViewerSelection(viewer, currentSelection);
  let version = 0;
  let selectedKey = "";
  async function render(record, { loading = false, error = "", retry } = {}) {
    const menuVersion = version;
    await assertViewerSelection(viewer, currentSelection);
    if (menuVersion !== version) return;
    const input = makeNodaMenuInput(record);
    if (loading) input.buildCitationFunction = undefined;
    input.userInputFunction = () => ({
      fields: record.metadataUnavailable
        ? [{ type: "label", label: "Source metadata is unavailable. This citation will contain the image link only." }]
        : [],
      resultData: {},
    });
    input.regeneralizeFunction = async () => {
      await assertViewerSelection(viewer, currentSelection);
      if (menuVersion !== version) throw new Error("The selected person changed. Choose the intended person again.");
    };
    input.customMenuFunction = (menu) => {
      if (menuVersion !== version) return;
      addViewerPersonPicker(menu, { groups, selectedKey, loading, unavailable, error, retry, onChoose: choose });
    };
    await setupSimplePopupMenu(input);
  }
  async function choose(key) {
    const requestVersion = ++version;
    selectedKey = key;
    const person = groups.flatMap((group) => group.entries).find((entry) => entry.key === key && entry.supported);
    try {
      if (!key) return await render(viewer);
      if (!person) throw new Error("Choose a supported primary subject or open their record directly.");
      await render(viewer, { loading: true });
      if (version !== requestVersion) return;
      const record = await loadViewerPerson(
        viewer,
        person,
        fetchPersonRecord,
        (html, url) => extractData(new DOMParser().parseFromString(html, "text/html"), url),
        currentSelection,
        () => version === requestVersion && selectedKey === key
      );
      if (version === requestVersion) await render(record);
    } catch (error) {
      if (version !== requestVersion) return;
      try {
        await assertViewerSelection(viewer, currentSelection);
      } catch (navigationError) {
        await displayMessageWithIcon("warning", "The Digitalarkivet image changed", navigationError.message);
        return;
      }
      selectedKey = "";
      version++;
      await render(viewer, { error: error.message, retry: person });
    }
  }
  await render(viewer);
}

async function setupNodaPopupMenu(extractedData, tabId) {
  let currentSelection;
  if (extractedData.newViewer) {
    try {
      if (
        !(await checkPermissionForSite("https://nye.digitalarkivet.no/*", {
          reason: "Read this image's public source and page metadata.",
          allowSkip: true,
        }))
      )
        return;
      currentSelection = async () => viewerSelectionFromUrl((await chrome.tabs.get(tabId)).url);
      displayBusyMessage("Loading Digitalarkivet source details...");
      extractedData = await loadViewerMetadata(
        viewerSelectionFromUrl(extractedData.url),
        fetchViewerJson,
        currentSelection
      );
      return await setupViewerPersonMenu(extractedData, currentSelection);
    } catch (error) {
      await displayMessageWithIcon("warning", "Could not prepare the Digitalarkivet citation", error.message);
      return;
    }
  }
  await setupSimplePopupMenu(makeNodaMenuInput(extractedData));
}

function makeNodaMenuInput(extractedData) {
  let doNotIncludeSearch = false;
  if (extractedData.pageType != "record") {
    doNotIncludeSearch = true;
  }

  let input = {
    extractedData: extractedData,
    extractFailedMessage: "It looks like a Digitalarkivet page but not a record or image page.",
    generalizeFailedMessage: "It looks like a Digitalarkivet page but does not contain the required data.",
    generalizeDataFunction: generalizeData,
    buildCitationFunction: buildCitation,
    buildHouseholdTableFunction: buildHouseholdTable,
    siteNameToExcludeFromSearch: "noda",
    doNotIncludeSearch: doNotIncludeSearch,
  };
  return input;
}

initPopup("noda", setupNodaPopupMenu);
