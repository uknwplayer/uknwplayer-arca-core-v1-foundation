import test from "node:test";
import assert from "node:assert/strict";
import {FederationOperatorB} from "../src/federation/operator-b.mjs";
import {
  MEGA_BRAIN_DISPATCH_ACTION,
  MEGA_BRAIN_RESULT_SUBMIT_ACTION,
  assertProbe,
  normalizeMegaBrainDispatchOutput,
  normalizeMegaBrainResultSubmission,
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
function vinceProbe(overrides={}){
  const params={task:{
    format:"arca-mega-brain-task-v1",
    version:1,
    missionId:"MBVINCE-001",
    taskId:"T-MBVINCE-001",
    objective:"Review this instruction epistemically before factual adoption.",
    requiredCapabilities:["critique"],
    dependencies:[],
    assignedNodeId:"node.vince",
    createdFromResultId:null
  }};
  const body={requestId:"mbvince-req-001",jobId:"mbvince-job-001",action:MEGA_BRAIN_DISPATCH_ACTION,params};
  return {format:"arca-federation-probe-v1",protocolVersion:3,originOperatorId:"arca-federation-operator-a",targetOperatorId:"arca-federation-operator-b",...body,payloadHash:sha256(body),...overrides};
}
function vinceOutput(overrides={}){
  return {
    format:"arca-mega-brain-dispatch-result-v1",
    version:1,
    resultId:"R-T-MBVINCE-001-vince",
    missionId:"MBVINCE-001",
    taskId:"T-MBVINCE-001",
    nodeId:"node.vince",
    claims:[{
      claimId:"C-T-MBVINCE-001-vince",
      text:"Vince preserved the task as instruction and performed epistemic review."
    }],
    evidence:[{
      evidenceId:"E-T-MBVINCE-001-vince",
      sourceRef:"vince://cognitive-trace/T-MBVINCE-001",
      contentDigest:"sha256:"+"a".repeat(64),
      claimIds:["C-T-MBVINCE-001-vince"]
    }],
    uncertainties:["The task objective is an instruction, not external factual evidence."],
    recommendedFollowups:[{
      objective:"Collect independent evidence.",
      requiredCapabilities:["research"]
    }],
    ...overrides
  };
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
test("Operador B mantém o dispatch determinístico legado para seu próprio nó",async()=>{
  const p=megaBrainProbe();
  const result=await new FederationOperatorB().receive(p);
  assert.equal(result.action,MEGA_BRAIN_DISPATCH_ACTION);
  assert.equal(result.output.format,"arca-mega-brain-dispatch-result-v1");
  assert.equal(result.output.nodeId,"arca-federation-operator-b");
  assert.equal(verifyFederationResult(result,p),true);
});
test("node.vince nunca cai no fixture determinístico do Operador B",async()=>{
  const p=vinceProbe();
  await assert.rejects(
    ()=>new FederationOperatorB().receive(p),
    /VINCE_COGNITIVE_RESULT_REQUIRED/
  );
});
test("Operador B aceita e embrulha resultado cognitivo válido do Vince",async()=>{
  const p=vinceProbe();
  const result=await new FederationOperatorB().receive(p,{megaBrainOutput:vinceOutput()});
  assert.equal(result.output.nodeId,"node.vince");
  assert.equal(result.output.evidence[0].sourceRef,"vince://cognitive-trace/T-MBVINCE-001");
  assert.deepEqual(result.output.recommendedFollowups[0].requiredCapabilities,["research"]);
  assert.equal(verifyFederationResult(result,p),true);
});
test("resultado Vince com target lógico adulterado é rejeitado antes da assinatura",async()=>{
  const p=vinceProbe();
  await assert.rejects(
    ()=>new FederationOperatorB().receive(p,{megaBrainOutput:vinceOutput({nodeId:"node.other"})}),
    /output node mismatch/
  );
});
test("resultado Vince não pode introduzir campos de autoridade fora do contrato",()=>{
  const p=vinceProbe();
  assert.throws(
    ()=>normalizeMegaBrainDispatchOutput({...vinceOutput(),truth:true},{task:p.params.task}),
    /unsupported field/
  );
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
  assert.throws(()=>verifyFederationResult(bad,p),/output node mismatch|result hash mismatch/);
});

test("submissão de resultado Vince é uma ação fechada e assinável separadamente",()=>{
  const original=vinceProbe();
  const params={
    originalRequestId:original.requestId,
    originalJobId:original.jobId,
    originalPayloadHash:original.payloadHash,
    ownerBindingHash:"b".repeat(64),
    acceptedStatementHash:"c".repeat(64),
    megaBrainOutput:vinceOutput()
  };
  const body={
    requestId:"mbvince-result-001",
    jobId:"mbvince-result-job-001",
    action:MEGA_BRAIN_RESULT_SUBMIT_ACTION,
    params
  };
  const submission={
    format:"arca-federation-probe-v1",
    protocolVersion:3,
    originOperatorId:"arca-federation-operator-a",
    targetOperatorId:"arca-federation-operator-b",
    ...body,
    payloadHash:sha256(body)
  };
  assert.equal(assertProbe(submission),true);
  const normalized=normalizeMegaBrainResultSubmission(params);
  assert.equal(normalized.originalRequestId,original.requestId);
  assert.equal(normalized.megaBrainOutput.nodeId,"node.vince");
});
test("submissão de resultado rejeita binding hash malformado",()=>{
  const original=vinceProbe();
  const params={
    originalRequestId:original.requestId,
    originalJobId:original.jobId,
    originalPayloadHash:original.payloadHash,
    ownerBindingHash:"not-a-hash",
    acceptedStatementHash:"c".repeat(64),
    megaBrainOutput:vinceOutput()
  };
  assert.throws(()=>normalizeMegaBrainResultSubmission(params),/invalid ownerBindingHash/);
});
