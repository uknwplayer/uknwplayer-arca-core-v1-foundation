import {createHash} from "node:crypto";

const SAFE=/^[A-Za-z0-9._-]{1,120}$/;
const CAPABILITY_MAX=160;
const MAX_TEXT=12000;
const MAX_SOURCE_REF=2000;
const MAX_DIGEST=512;
export const FEDERATION_PROBE_FORMAT="arca-federation-probe-v1";
export const FEDERATION_RESULT_FORMAT="arca-federation-result-v1";
export const MEGA_BRAIN_TASK_FORMAT="arca-mega-brain-task-v1";
export const MEGA_BRAIN_DISPATCH_RESULT_FORMAT="arca-mega-brain-dispatch-result-v1";
export const MEGA_BRAIN_DISPATCH_ACTION="mega-brain.dispatch";
export const MEGA_BRAIN_RESULT_SUBMIT_ACTION="mega-brain.result.submit";

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function sha256(value){
  return createHash("sha256").update(typeof value==="string"?value:JSON.stringify(stable(value))).digest("hex");
}
function safe(value,label){if(typeof value!=="string"||!SAFE.test(value))throw new Error("invalid "+label);return value;}
function plain(value){return !!value&&typeof value==="object"&&!Array.isArray(value)}
function exactKeys(value,allowed,label){
  if(!plain(value))throw new Error(label+" object required");
  for(const key of Object.keys(value))if(!allowed.has(key))throw new Error(label+" contains unsupported field: "+key);
  for(const key of allowed)if(!(key in value))throw new Error(label+" missing required field: "+key);
}
function boundedText(value,label,max=MAX_TEXT){
  if(typeof value!=="string"||!value.trim()||value.length>max)throw new Error("invalid "+label);
  return value;
}
function stringArray(value,label,{maxItems=64,safeIds=false,maxLength=CAPABILITY_MAX}={}){
  if(!Array.isArray(value)||value.length>maxItems)throw new Error("invalid "+label);
  const out=[];const seen=new Set();
  for(const raw of value){
    if(typeof raw!=="string"||!raw.trim()||raw.length>maxLength)throw new Error("invalid "+label);
    const item=raw.trim();if(safeIds&&!SAFE.test(item))throw new Error("invalid "+label);
    if(seen.has(item))throw new Error("duplicate "+label);
    seen.add(item);out.push(item);
  }
  return out.sort();
}

export function normalizeMegaBrainTask(value){
  exactKeys(value,new Set(["format","version","missionId","taskId","objective","requiredCapabilities","dependencies","assignedNodeId","createdFromResultId"]),"mega brain task");
  if(value.format!==MEGA_BRAIN_TASK_FORMAT||value.version!==1)throw new Error("unsupported mega brain task");
  return Object.freeze({
    format:MEGA_BRAIN_TASK_FORMAT,
    version:1,
    missionId:safe(value.missionId,"missionId"),
    taskId:safe(value.taskId,"taskId"),
    objective:boundedText(value.objective,"mega brain objective"),
    requiredCapabilities:stringArray(value.requiredCapabilities,"requiredCapabilities"),
    dependencies:stringArray(value.dependencies,"dependencies",{safeIds:true,maxLength:120}),
    assignedNodeId:safe(value.assignedNodeId,"assignedNodeId"),
    createdFromResultId:value.createdFromResultId==null?null:safe(value.createdFromResultId,"createdFromResultId")
  });
}

function assertMegaBrainParams(params){
  exactKeys(params,new Set(["task"]),"mega brain params");
  return normalizeMegaBrainTask(params.task);
}
const HASH=/^[a-f0-9]{64}$/;
function hash(value,label){if(typeof value!=="string"||!HASH.test(value))throw new Error("invalid "+label);return value;}
export function normalizeMegaBrainResultSubmission(params){
  exactKeys(params,new Set([
    "originalRequestId","originalJobId","originalPayloadHash",
    "ownerBindingHash","acceptedStatementHash","megaBrainOutput"
  ]),"mega brain result submission");
  if(!plain(params.megaBrainOutput))throw new Error("mega brain output object required");
  if(params.megaBrainOutput.format!==MEGA_BRAIN_DISPATCH_RESULT_FORMAT||params.megaBrainOutput.version!==1)throw new Error("unsupported submitted mega brain output");
  return Object.freeze({
    originalRequestId:safe(params.originalRequestId,"originalRequestId"),
    originalJobId:safe(params.originalJobId,"originalJobId"),
    originalPayloadHash:hash(params.originalPayloadHash,"originalPayloadHash"),
    ownerBindingHash:hash(params.ownerBindingHash,"ownerBindingHash"),
    acceptedStatementHash:hash(params.acceptedStatementHash,"acceptedStatementHash"),
    megaBrainOutput:params.megaBrainOutput
  });
}

function normalizeClaim(value){
  exactKeys(value,new Set(["claimId","text"]),"mega brain claim");
  return Object.freeze({
    claimId:safe(value.claimId,"claimId"),
    text:boundedText(value.text,"claim text")
  });
}
function normalizeEvidence(value){
  exactKeys(value,new Set(["evidenceId","sourceRef","contentDigest","claimIds"]),"mega brain evidence");
  return Object.freeze({
    evidenceId:safe(value.evidenceId,"evidenceId"),
    sourceRef:boundedText(value.sourceRef,"evidence sourceRef",MAX_SOURCE_REF),
    contentDigest:boundedText(value.contentDigest,"evidence contentDigest",MAX_DIGEST),
    claimIds:stringArray(value.claimIds,"claimIds",{safeIds:true,maxLength:120,maxItems:128})
  });
}
function normalizeFollowup(value){
  exactKeys(value,new Set(["objective","requiredCapabilities"]),"mega brain followup");
  return Object.freeze({
    objective:boundedText(value.objective,"followup objective"),
    requiredCapabilities:stringArray(value.requiredCapabilities,"followup requiredCapabilities")
  });
}

export function normalizeMegaBrainDispatchOutput(value,{task}={}){
  const normalizedTask=normalizeMegaBrainTask(task);
  exactKeys(value,new Set([
    "format","version","resultId","missionId","taskId","nodeId",
    "claims","evidence","uncertainties","recommendedFollowups"
  ]),"mega brain dispatch output");
  if(value.format!==MEGA_BRAIN_DISPATCH_RESULT_FORMAT||value.version!==1)throw new Error("unsupported mega brain dispatch output");
  if(value.missionId!==normalizedTask.missionId)throw new Error("mega brain output mission mismatch");
  if(value.taskId!==normalizedTask.taskId)throw new Error("mega brain output task mismatch");
  if(value.nodeId!==normalizedTask.assignedNodeId)throw new Error("mega brain output node mismatch");
  if(!Array.isArray(value.claims)||value.claims.length>128)throw new Error("invalid mega brain claims");
  if(!Array.isArray(value.evidence)||value.evidence.length>128)throw new Error("invalid mega brain evidence");
  if(!Array.isArray(value.uncertainties)||value.uncertainties.length>64)throw new Error("invalid mega brain uncertainties");
  if(!Array.isArray(value.recommendedFollowups)||value.recommendedFollowups.length>32)throw new Error("invalid mega brain followups");

  const claims=value.claims.map(normalizeClaim);
  const claimIds=new Set();
  for(const item of claims){
    if(claimIds.has(item.claimId))throw new Error("duplicate mega brain claimId");
    claimIds.add(item.claimId);
  }
  const evidence=value.evidence.map(normalizeEvidence);
  const evidenceIds=new Set();
  for(const item of evidence){
    if(evidenceIds.has(item.evidenceId))throw new Error("duplicate mega brain evidenceId");
    evidenceIds.add(item.evidenceId);
  }
  return Object.freeze({
    format:MEGA_BRAIN_DISPATCH_RESULT_FORMAT,
    version:1,
    resultId:safe(value.resultId,"resultId"),
    missionId:normalizedTask.missionId,
    taskId:normalizedTask.taskId,
    nodeId:normalizedTask.assignedNodeId,
    claims:Object.freeze(claims),
    evidence:Object.freeze(evidence),
    uncertainties:Object.freeze(value.uncertainties.map(v=>boundedText(v,"uncertainty",4000))),
    recommendedFollowups:Object.freeze(value.recommendedFollowups.map(normalizeFollowup))
  });
}

export function assertProbe(value){
  if(!value||value.format!==FEDERATION_PROBE_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation probe");
  safe(value.requestId,"requestId"); safe(value.jobId,"jobId"); safe(value.originOperatorId,"originOperatorId");
  if(value.targetOperatorId!=="arca-federation-operator-b")throw new Error("unexpected federation target");
  if(value.action==="worker.ping"){
    if(!plain(value.params??{}))throw new Error("invalid ping params");
  }else if(value.action===MEGA_BRAIN_DISPATCH_ACTION){
    assertMegaBrainParams(value.params);
  }else if(value.action===MEGA_BRAIN_RESULT_SUBMIT_ACTION){
    normalizeMegaBrainResultSubmission(value.params);
  }else{
    throw new Error("federation action not allowed");
  }
  if(value.payloadHash!==sha256({requestId:value.requestId,jobId:value.jobId,action:value.action,params:value.params??{}}))throw new Error("federation payload hash mismatch");
  return true;
}

export function createPingResult(probe,{operatorId="arca-federation-operator-b"}={}){
  assertProbe(probe);
  if(probe.action!=="worker.ping")throw new Error("ping probe required");
  const result={format:FEDERATION_RESULT_FORMAT,protocolVersion:3,requestId:probe.requestId,jobId:probe.jobId,operatorId,status:"completed",action:"worker.ping",output:{ok:true,echo:probe.params?.echo??null},requestHash:probe.payloadHash};
  return {...result,resultHash:sha256(result)};
}

export function createMegaBrainResult(probe,{operatorId="arca-federation-operator-b",megaBrainOutput,delegationStatementHash}={}){
  assertProbe(probe);
  if(probe.action!==MEGA_BRAIN_DISPATCH_ACTION)throw new Error("mega brain probe required");
  const task=assertMegaBrainParams(probe.params);
  let output;
  if(megaBrainOutput!==undefined){
    output=normalizeMegaBrainDispatchOutput(megaBrainOutput,{task});
  }else{
    if(task.assignedNodeId==="node.vince")throw new Error("VINCE_COGNITIVE_RESULT_REQUIRED");
    const claimId="C-"+task.taskId+"-operator-b";
    const evidenceId="E-"+task.taskId+"-operator-b";
    output=normalizeMegaBrainDispatchOutput({
      format:MEGA_BRAIN_DISPATCH_RESULT_FORMAT,
      version:1,
      resultId:"R-"+task.taskId+"-operator-b",
      missionId:task.missionId,
      taskId:task.taskId,
      nodeId:task.assignedNodeId,
      claims:[{
        claimId,
        text:"Federated Operator B processed the bounded Mega Brain task."
      }],
      evidence:[{
        evidenceId,
        sourceRef:"federation://operator-b/"+task.taskId,
        contentDigest:"sha256:"+sha256({requestId:probe.requestId,taskId:task.taskId,operatorId}),
        claimIds:[claimId]
      }],
      uncertainties:[
        "Federation proof validates signed transport and bounded execution, not external factual truth."
      ],
      recommendedFollowups:[]
    },{task});
  }
  const result={
    format:FEDERATION_RESULT_FORMAT,
    protocolVersion:3,
    requestId:probe.requestId,
    jobId:probe.jobId,
    operatorId,
    status:"completed",
    action:MEGA_BRAIN_DISPATCH_ACTION,
    output,
    requestHash:probe.payloadHash,
    ...(delegationStatementHash===undefined?{}:{delegationStatementHash:hash(delegationStatementHash,"delegationStatementHash")})
  };
  return {...result,resultHash:sha256(result)};
}

export function createFederationResult(probe,options={}){
  assertProbe(probe);
  if(probe.action==="worker.ping")return createPingResult(probe,options);
  if(probe.action===MEGA_BRAIN_DISPATCH_ACTION)return createMegaBrainResult(probe,options);
  throw new Error("federation result creation unsupported for action: "+probe.action);
}

export function verifyFederationResult(value,probe){
  assertProbe(probe);
  if(!value||value.format!==FEDERATION_RESULT_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation result");
  if(value.requestId!==probe.requestId||value.jobId!==probe.jobId||value.operatorId!=="arca-federation-operator-b")throw new Error("federation result correlation mismatch");
  if(value.status!=="completed"||value.action!==probe.action||value.requestHash!==probe.payloadHash)throw new Error("invalid federation completion");
  const {resultHash,...body}=value;
  if(resultHash!==sha256(body))throw new Error("federation result hash mismatch");
  if(probe.action===MEGA_BRAIN_DISPATCH_ACTION){
    normalizeMegaBrainDispatchOutput(value.output,{task:probe.params.task});
  }
  return true;
}

export function verifyPingResult(value,probe){
  if(probe?.action!=="worker.ping")throw new Error("ping probe required");
  return verifyFederationResult(value,probe);
}
