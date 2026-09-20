import {createHash} from "node:crypto";

const SAFE=/^[A-Za-z0-9._-]{1,120}$/;
const CAPABILITY_MAX=160;
export const FEDERATION_PROBE_FORMAT="arca-federation-probe-v1";
export const FEDERATION_RESULT_FORMAT="arca-federation-result-v1";
export const MEGA_BRAIN_TASK_FORMAT="arca-mega-brain-task-v1";
export const MEGA_BRAIN_DISPATCH_RESULT_FORMAT="arca-mega-brain-dispatch-result-v1";
export const MEGA_BRAIN_DISPATCH_ACTION="mega-brain.dispatch";

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
function exactKeys(value,allowed,label){for(const key of Object.keys(value))if(!allowed.has(key))throw new Error(label+" contains unsupported field: "+key)}
function stringArray(value,label,{maxItems=64,safeIds=false}={}){
  if(!Array.isArray(value)||value.length>maxItems)throw new Error("invalid "+label);
  const out=[];const seen=new Set();
  for(const raw of value){
    if(typeof raw!=="string"||!raw.trim()||raw.length>CAPABILITY_MAX)throw new Error("invalid "+label);
    const item=raw.trim();if(safeIds&&!SAFE.test(item))throw new Error("invalid "+label);
    if(seen.has(item))throw new Error("duplicate "+label);
    seen.add(item);out.push(item);
  }
  return out.sort();
}

export function normalizeMegaBrainTask(value){
  if(!plain(value))throw new Error("mega brain task required");
  exactKeys(value,new Set(["format","version","missionId","taskId","objective","requiredCapabilities","dependencies","assignedNodeId","createdFromResultId"]),"mega brain task");
  if(value.format!==MEGA_BRAIN_TASK_FORMAT||value.version!==1)throw new Error("unsupported mega brain task");
  const objective=String(value.objective??"");
  if(!objective.trim()||objective.length>12000)throw new Error("invalid mega brain objective");
  return Object.freeze({
    format:MEGA_BRAIN_TASK_FORMAT,
    version:1,
    missionId:safe(value.missionId,"missionId"),
    taskId:safe(value.taskId,"taskId"),
    objective,
    requiredCapabilities:stringArray(value.requiredCapabilities,"requiredCapabilities"),
    dependencies:stringArray(value.dependencies,"dependencies",{safeIds:true}),
    assignedNodeId:safe(value.assignedNodeId,"assignedNodeId"),
    createdFromResultId:value.createdFromResultId==null?null:safe(value.createdFromResultId,"createdFromResultId")
  });
}

function assertMegaBrainParams(params){
  if(!plain(params))throw new Error("mega brain params required");
  exactKeys(params,new Set(["task"]),"mega brain params");
  return normalizeMegaBrainTask(params.task);
}

export function assertProbe(value){
  if(!value||value.format!==FEDERATION_PROBE_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation probe");
  safe(value.requestId,"requestId"); safe(value.jobId,"jobId"); safe(value.originOperatorId,"originOperatorId");
  if(value.targetOperatorId!=="arca-federation-operator-b")throw new Error("unexpected federation target");
  if(value.action==="worker.ping"){
    if(!plain(value.params??{}))throw new Error("invalid ping params");
  }else if(value.action===MEGA_BRAIN_DISPATCH_ACTION){
    assertMegaBrainParams(value.params);
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

export function createMegaBrainResult(probe,{operatorId="arca-federation-operator-b"}={}){
  assertProbe(probe);
  if(probe.action!==MEGA_BRAIN_DISPATCH_ACTION)throw new Error("mega brain probe required");
  const task=assertMegaBrainParams(probe.params);
  const claimId="C-"+task.taskId+"-operator-b";
  const evidenceId="E-"+task.taskId+"-operator-b";
  const output={
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
  };
  const result={format:FEDERATION_RESULT_FORMAT,protocolVersion:3,requestId:probe.requestId,jobId:probe.jobId,operatorId,status:"completed",action:MEGA_BRAIN_DISPATCH_ACTION,output,requestHash:probe.payloadHash};
  return {...result,resultHash:sha256(result)};
}

export function createFederationResult(probe,options={}){
  assertProbe(probe);
  return probe.action==="worker.ping"?createPingResult(probe,options):createMegaBrainResult(probe,options);
}

export function verifyFederationResult(value,probe){
  assertProbe(probe);
  if(!value||value.format!==FEDERATION_RESULT_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation result");
  if(value.requestId!==probe.requestId||value.jobId!==probe.jobId||value.operatorId!=="arca-federation-operator-b")throw new Error("federation result correlation mismatch");
  if(value.status!=="completed"||value.action!==probe.action||value.requestHash!==probe.payloadHash)throw new Error("invalid federation completion");
  const {resultHash,...body}=value;
  if(resultHash!==sha256(body))throw new Error("federation result hash mismatch");
  if(probe.action===MEGA_BRAIN_DISPATCH_ACTION){
    const task=normalizeMegaBrainTask(probe.params.task);
    const output=value.output;
    if(!plain(output)||output.format!==MEGA_BRAIN_DISPATCH_RESULT_FORMAT||output.version!==1)throw new Error("invalid mega brain federation output");
    if(output.missionId!==task.missionId||output.taskId!==task.taskId||output.nodeId!==task.assignedNodeId)throw new Error("mega brain federation output correlation mismatch");
  }
  return true;
}

export function verifyPingResult(value,probe){
  if(probe?.action!=="worker.ping")throw new Error("ping probe required");
  return verifyFederationResult(value,probe);
}
