import fs from "node:fs";

const required = ["README.md", "FEDERATION_PROOF.md", "federation/operator.json"];
for (const path of required) {
  if (!fs.existsSync(path)) throw new Error(`arquivo obrigatório ausente: ${path}`);
}
const operator = JSON.parse(fs.readFileSync("federation/operator.json", "utf8"));
if (operator.schemaVersion !== 1) throw new Error("schemaVersion inválida");
if (operator.operatorId !== "arca-federation-operator-b") throw new Error("operatorId inesperado");
if (operator.canonicalProject !== "uknwplayer/arca-core-v1-foundation") throw new Error("projeto canônico inesperado");
if (operator.trustMode !== "explicit") throw new Error("trustMode deve ser explicit");
if (operator.automaticFailover !== false) throw new Error("failover automático deve permanecer desativado");
if (operator.acceptsArbitraryShell !== false) throw new Error("shell arbitrário deve permanecer desativado");
console.log("Operador B: configuração mínima válida.");
