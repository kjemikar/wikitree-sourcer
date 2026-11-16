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

// Only primary subjects can be chosen for direct citation. Other roles retain
// their canonical record links instead of inheriting somebody else's event.
function addViewerPersonPicker(menu, { groups, selectedKey, onChoose, loading, unavailable, error, retry }) {
  const container = document.createElement("div");
  container.className = "dialogLine";
  const label = document.createElement("label");
  label.textContent = "Person in this image: ";
  const select = document.createElement("select");
  select.id = "noda-viewer-person";
  select.className = "dialogSelector";
  const image = document.createElement("option");
  image.value = "";
  image.textContent = "Image citation only";
  select.append(image);
  for (const group of groups) {
    const options = document.createElement("optgroup");
    options.label = group.label;
    for (const person of group.entries) {
      const option = document.createElement("option");
      option.value = person.key;
      option.textContent = `${person.name} — ${person.role}`;
      option.disabled = !person.supported;
      options.append(option);
    }
    select.append(options);
  }
  select.value = selectedKey;
  select.onchange = () => onChoose(select.value);
  label.append(select);
  container.append(label);
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  status.textContent = loading
    ? "Loading the chosen person's full record..."
    : error ||
      (unavailable
        ? "The transcription list could not be loaded. Image citation is still available."
        : groups.length
        ? "Choose a primary subject to cite their full record. Other roles can be opened below."
        : "No transcribed people are available for this image.");
  container.append(status);
  if (retry) {
    const button = document.createElement("button");
    button.textContent = "Retry chosen record";
    button.onclick = () => onChoose(retry.key);
    container.append(button);
  }
  const people = groups.flatMap((group) => group.entries);
  if (people.length) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Open person records";
    details.append(summary);
    for (const person of people) {
      const line = document.createElement("div");
      const link = document.createElement("a");
      link.href = person.recordUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${person.name} — ${person.role}, ${person.date}`;
      line.append(link);
      details.append(line);
    }
    container.append(details);
  }
  menu.list.append(container);
}
export { addViewerPersonPicker };
