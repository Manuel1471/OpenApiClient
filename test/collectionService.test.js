const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createCollectionData,
  importOpenApi,
  sanitizeForExport,
  loadCollection,
  saveCollection,
  upsertRequest,
} = require("../src/services/collectionService");

test("redacts credentials from portable collection exports", () => {
  const safe = sanitizeForExport(
    createCollectionData({
      requests: [
        {
          auth: { type: "bearer", token: "secret" },
          headers: [{ key: "Authorization", value: "Bearer secret" }],
        },
      ],
    }),
  );
  assert.equal(safe.requests[0].auth.token, "");
  assert.equal(safe.requests[0].headers[0].value, "");
});

test("imports an OpenAPI specification into runnable requests", () => {
  const collection = importOpenApi({
    openapi: "3.0.0",
    info: { title: "Pets" },
    servers: [{ url: "https://api.example.com" }],
    paths: {
      "/pets": {
        get: { summary: "List pets" },
        post: { operationId: "createPet" },
      },
    },
  });
  assert.equal(collection.info.name, "Pets");
  assert.equal(collection.requests.length, 2);
  assert.equal(collection.requests[0].url, "https://api.example.com/pets");
});

test("imports OpenAPI schema examples and declared security", () => {
  const collection = importOpenApi({
    openapi: "3.0.0",
    info: { title: "Secured API" },
    components: {
      securitySchemes: { apiKey: { type: "apiKey", in: "header", name: "X-API-Key" } },
      schemas: { Payload: { type: "object", properties: { active: { type: "boolean" }, name: { type: "string" } } } },
    },
    paths: {
      "/items": { post: { security: [{ apiKey: [] }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Payload" } } } } } },
    },
  });
  const request = collection.requests[0];
  assert.deepEqual(JSON.parse(request.body.content), { active: false, name: "string" });
  assert.deepEqual(request.auth, { type: "apikey", keyName: "X-API-Key", token: "{{token}}" });
});

test("crea una colección con estructura compatible", () => {
  const collection = createCollectionData({ name: "API de prueba" });
  assert.equal(collection.info.name, "API de prueba");
  assert.deepEqual(collection.requests, []);
  assert.equal(collection.info.version, "1.0.0");
});

test("guarda y vuelve a cargar una colección", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "openapi-client-"));
  const filePath = path.join(directory, "collection.json");
  const collection = createCollectionData({
    name: "Persistencia",
    requests: [
      { id: "get-users", method: "GET", url: "https://example.com/users" },
    ],
  });
  await saveCollection(filePath, collection);
  assert.deepEqual(await loadCollection(filePath), collection);
  await fs.rm(directory, { recursive: true, force: true });
});

test("guarda requests separadas y actualiza solamente la request seleccionada", () => {
  const collection = createCollectionData({
    requests: [{ id: "one", name: "Primera", method: "GET" }],
  });
  const withSecond = upsertRequest(collection, {
    id: "two",
    name: "Segunda",
    method: "POST",
  });
  assert.equal(withSecond.requests.length, 2);
  const updated = upsertRequest(
    withSecond,
    { id: "one", name: "Primera editada", method: "GET" },
    "one",
  );
  assert.equal(updated.requests.length, 2);
  assert.equal(updated.requests[0].name, "Primera editada");
});
