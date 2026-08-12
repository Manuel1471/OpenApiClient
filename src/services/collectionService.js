const fs = require("fs").promises;
const YAML = require("yaml");

function createCollectionData(input = {}) {
  return {
    info: {
      name: input.name || "Mi Colección",
      description: input.description || "",
      version: input.version || "1.0.0",
      createdAt: input.createdAt || new Date().toISOString(),
    },
    collections: input.collections || [],
    requests: input.requests || [],
  };
}

async function saveCollection(filePath, collection) {
  await fs.writeFile(filePath, JSON.stringify(collection, null, 2), "utf-8");
  return filePath;
}

async function loadCollection(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf-8"));
}

function upsertRequest(collection, request, requestId) {
  const requests = collection.requests || [];
  const index = requestId
    ? requests.findIndex((item) => item.id === requestId)
    : -1;
  if (index >= 0) requests[index] = request;
  else requests.push(request);
  return { ...collection, requests };
}

function sanitizeForExport(collection) {
  const safe = structuredClone(collection);
  safe.requests = (safe.requests || []).map((request) => ({
    ...request,
    auth: request.auth
      ? { ...request.auth, token: "", password: "" }
      : request.auth,
    headers: (request.headers || []).map((header) =>
      /authorization|api[-_]?key|token|secret/i.test(header.key)
        ? { ...header, value: "" }
        : header,
    ),
  }));
  return safe;
}

function importOpenApi(source) {
  const spec = typeof source === "string" ? YAML.parse(source) : source;
  if (!spec?.openapi && !spec?.swagger)
    throw new Error("The file is not an OpenAPI/Swagger specification.");
  const baseUrl =
    spec.servers?.[0]?.url ||
    `${spec.schemes?.[0] || "https"}://${spec.host || ""}${spec.basePath || ""}`;
  const requests = Object.entries(spec.paths || {}).flatMap(
    ([route, operations]) =>
      Object.entries(operations)
        .filter(([method]) =>
          ["get", "post", "put", "patch", "delete", "head", "options"].includes(
            method,
          ),
        )
        .map(([method, operation]) => {
          const parameters = [...(operations.parameters || []), ...(operation.parameters || [])];
          const params = parameters.filter(parameter => parameter.in === "query").map(parameter => ({ key: parameter.name, value: parameter.example ?? parameter.schema?.example ?? "" }));
          const headers = parameters.filter(parameter => parameter.in === "header").map(parameter => ({ key: parameter.name, value: parameter.example ?? parameter.schema?.example ?? "" }));
          const content = operation.requestBody?.content?.["application/json"];
          const example = content?.example ?? Object.values(content?.examples || {})[0]?.value ?? exampleFromSchema(content?.schema, spec);
          const secured = operation.security || spec.security;
          const auth = authFromSecurity(secured, spec.components?.securitySchemes);
          return ({
          id: crypto.randomUUID(),
          name:
            operation.summary ||
            operation.operationId ||
            `${method.toUpperCase()} ${route}`,
          method: method.toUpperCase(),
          url: `${baseUrl}${route}`,
          params,
          headers,
          body: { type: example === undefined ? "none" : "raw", format: "json", content: example === undefined ? "" : JSON.stringify(example, null, 2), formData: [] },
          auth,
        });
      }),
  );
  return createCollectionData({
    name: spec.info?.title || "OpenAPI import",
    description: spec.info?.description || "",
    version: spec.info?.version || "1.0.0",
    requests,
  });
}

function exampleFromSchema(schema, spec, seen = new Set()) {
  if (!schema || typeof schema !== "object") return undefined;
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.$ref) {
    if (seen.has(schema.$ref)) return undefined;
    seen.add(schema.$ref);
    return exampleFromSchema(resolveRef(schema.$ref, spec), spec, seen);
  }
  if (schema.enum?.length) return schema.enum[0];
  if (schema.type === "array") return [exampleFromSchema(schema.items || {}, spec, seen)];
  if (schema.type === "object" || schema.properties) {
    return Object.fromEntries(Object.entries(schema.properties || {}).map(([key, value]) => [key, exampleFromSchema(value, spec, seen)]));
  }
  return { string: "string", integer: 0, number: 0, boolean: false }[schema.type];
}

function resolveRef(reference, spec) {
  return reference.replace(/^#\//, "").split("/").reduce((value, key) => value?.[key], spec);
}

function authFromSecurity(security, schemes = {}) {
  const name = security?.[0] && Object.keys(security[0])[0];
  const scheme = name ? schemes[name] : null;
  if (!scheme) return { type: "none" };
  if (scheme.type === "apiKey") return { type: "apikey", keyName: scheme.name || "X-API-Key", token: "{{token}}" };
  if (scheme.scheme === "basic") return { type: "basic", username: "{{username}}", password: "{{password}}" };
  return { type: "bearer", token: "{{token}}" };
}

module.exports = {
  createCollectionData,
  saveCollection,
  loadCollection,
  upsertRequest,
  importOpenApi,
  sanitizeForExport,
  exampleFromSchema,
  authFromSecurity,
};
