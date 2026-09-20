import test from "node:test";
import assert from "node:assert/strict";
import {FederationOperatorB} from "../src/federation/operator-b.mjs";
import {
  MEGA_BRAIN_DISPATCH_ACTION,
  sha256,
  verifyFederationResult,
  verifyPingResult
} from "../src/federation/protocol.mjs";

function probe(overrides={}){
  const body={requestId:"fed-req-001",jobId:"fed-job-001",action:"worker.ping",params:{echo:"A->B"}};
  return {format:"arca-federation-probe-v1",protocolVersion:3,originOperatorId:"arca-federation-operator-a",targetOperatorId:"arca-federation-operator-b",...body,payloadHash:sha256(body),...overrides};
}
function megaBrainProbe(overrides={}){
  const params={task:{
    format:"arca-mega-brain-task-v1",
    version:1,
    missionId:"MBFED-001",
    taskId:"T-MBFED-001",
    objective:"Execute bounded federated Mega Brain probe.",
    requiredCapabilities:["federation-proof"],
    dependencies:[],
    assignedNodeId:"arca-federation-operator-b",
    createdFromResultId:null
  }};
  const body={requestId:"mbfed-req-001",jobId:"mbfed-job-001",action:MEGA_BRAIN_DISPATCH_ACTION,params};
  return {format:"arca-federation-probe-v1",protocolVersion:3,originOperatorId:"arca-federation-operator-a",targetOperatorId:"arca-federation-operator-b",...body,payloadHash:sha256(body),...overrides};
}

test("Operador B executa worker.ping confiável e correlacionado",async()=>{
  const p=probe(); const result=await new FederationOperatorB().receive(p);
  assert.equal(result.output.echo,"A->B"); assert.equal(verifyPingResult(result,p),true);
});
test("Operador B rejeita origem não confiável",async()=>{
  await assert.rejects(()=>new FederationOperatorB().receive(probe({originOperatorId:"intruso"})),/untrusted federation origin/);
});
test("Operador B rejeita ação fora da allowlist",async()=>{
  const p=probe({action:"shell.exec"}); await assert.rejects(()=>new FederationOperatorB().receive(p),/action not allowed|payload hash mismatch/);
});
test("adulteração do resultado é detectada",async()=>{
  const p=probe(); const result=await new FederationOperatorB().receive(p);
  assert.throws(()=>verifyPingResult({...result,output:{ok:false}},p),/result hash mismatch/);
});
test("Operador B aceita Mega Brain dispatch estruturado sem ampliar para ação arbitrária",async()=>{
  const p=megaBrainProbe();
  const result=await new FederationOperatorB().receive(p);
  assert.equal(result.action,MEGA_BRAIN_DISPATCH_ACTION);
  assert.equal(result.output.format,"arca-mega-brain-dispatch-result-v1");
  assert.equal(result.output.missionId,"MBFED-001");
  assert.equal(result.output.taskId,"T-MBFED-001");
  assert.equal(result.output.nodeId,"arca-federation-operator-b");
  assert.equal(result.output.claims.length,1);
  assert.equal(verifyFederationResult(result,p),true);
});
test("Mega Brain probe rejeita campos de comando fora do contrato",async()=>{
  const p=megaBrainProbe();
  const params={...p.params,action:"repository.check"};
  const bad={...p,params,payloadHash:sha256({requestId:p.requestId,jobId:p.jobId,action:p.action,params})};
  await assert.rejects(()=>new FederationOperatorB().receive(bad),/unsupported field/);
});
test("Mega Brain probe rejeita target lógico adulterado no resultado",async()=>{
  const p=megaBrainProbe();
  const result=await new FederationOperatorB().receive(p);
  const badOutput={...result.output,nodeId:"node.other"};
  const body={...result,output:badOutput};delete body.resultHash;
  const bad={...body,resultHash:sha256(body)};
  assert.throws(()=>verifyFederationResult(bad,p),/output correlation mismatch/);
});
