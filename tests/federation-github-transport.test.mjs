import test from "node:test";
import assert from "node:assert/strict";
import {createGitHubFederationTransport,federationInboxPath,federationOutboxPath} from "../src/federation/github-transport.mjs";

test("transporte fixa a fronteira no repositório do Operador B",async()=>{
 const writes=[]; const transport=createGitHubFederationTransport({
   readFile:async ({path})=>path.endsWith("req-001.json")?JSON.stringify({requestId:"req-001"}):null,
   createFile:async value=>writes.push(value)
 });
 assert.deepEqual(await transport.receive("req-001"),{requestId:"req-001"});
 const receipt=await transport.publishResult("req-001",{status:"completed"});
 assert.equal(receipt.repository,"uknwplayer/uknwplayer-arca-core-v1-foundation");
 assert.equal(writes[0].path,"federation/outbox/req-001.json");
});
test("paths não aceitam traversal",()=>{
 assert.throws(()=>federationInboxPath({requestId:"../segredo"}),/invalid requestId/);
 assert.throws(()=>federationOutboxPath({requestId:"a/b"}),/invalid requestId/);
});
test("transporte rejeita outro repositório",()=>{
 assert.throws(()=>createGitHubFederationTransport({repository:"outro/projeto",readFile:async()=>{},createFile:async()=>{}}),/unexpected federation repository/);
});
