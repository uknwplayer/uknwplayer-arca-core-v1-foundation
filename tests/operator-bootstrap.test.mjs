import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const operator = JSON.parse(fs.readFileSync("federation/operator.json", "utf8"));

test("Operador B possui identidade independente", () => {
  assert.equal(operator.operatorId, "arca-federation-operator-b");
  assert.equal(operator.role, "federation-peer");
  assert.equal(operator.repository, "uknwplayer/uknwplayer-arca-core-v1-foundation");
});

test("fronteiras críticas permanecem fail-closed", () => {
  assert.equal(operator.trustMode, "explicit");
  assert.equal(operator.automaticFailover, false);
  assert.equal(operator.acceptsArbitraryShell, false);
});

test("Operador B permanece ligado somente ao projeto ARCA canônico", () => {
  assert.equal(operator.canonicalProject, "uknwplayer/arca-core-v1-foundation");
});
