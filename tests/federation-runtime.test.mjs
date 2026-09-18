import test from "node:test";
import assert from "node:assert/strict";
import {FederationOperatorB} from "../src/federation/operator-b.mjs";
import {sha256,verifyPingResult} from "../src/federation/protocol.mjs";

function probe(overrides={}){
  const body={requestId:"fed-req-001",jobId:"fed-job-001",action:"worker.ping",params:{echo:"A->B"}};
  return {format:"arca-federation-probe-v1",protocolVersion:3,originOperatorId:"arca-federation-operator-a",targetOperatorId:"arca-federation-operator-b",...body,payloadHash:sha256(body),...overrides};
}
test("Operador B executa somente worker.ping confiável e correlacionado",async()=>{
  const p=probe(); const result=await new FederationOperatorB().receive(p);
  assert.equal(result.output.echo,"A->B"); assert.equal(verifyPingResult(result,p),true);
});
test("Operador B rejeita origem não confiável",async()=>{
  await assert.rejects(()=>new FederationOperatorB().receive(probe({originOperatorId:"intruso"})),/untrusted federation origin/);
});
test("Operador B rejeita ação fora da capacidade limitada",async()=>{
  const p=probe({action:"shell.exec"}); await assert.rejects(()=>new FederationOperatorB().receive(p),/action not allowed|payload hash mismatch/);
});
test("adulteração do resultado é detectada",async()=>{
  const p=probe(); const result=await new FederationOperatorB().receive(p);
  assert.throws(()=>verifyPingResult({...result,output:{ok:false}},p),/result hash mismatch/);
});
