const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("todos los idiomas contienen las mismas claves de traducción", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../renderer/assets/js/translations.js"),
    "utf8",
  );
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const translations = context.window.translations;
  const expectedLanguages = ["es", "en", "fr", "de"];
  assert.deepEqual(Object.keys(translations), expectedLanguages);
  const keys = Object.keys(translations.es).sort();
  expectedLanguages.forEach((language) =>
    assert.deepEqual(Object.keys(translations[language]).sort(), keys),
  );
});
