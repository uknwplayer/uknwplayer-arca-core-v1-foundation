import {createHash} from "node:crypto";

const SAFE=/^[A-Za-z0-9._-]{1,120}$/;
export const FEDERATION_PROBE_FORMAT="arca-federation-probe-v1";
export const FEDERATION_RESULT_FORMAT="arca-federation-result-v1";

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==="object") return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
export function sha256(value){
  return createHash("sha256").update(typeof value==="string"?value:JSON.stringify(stable(value))).digest("hex");
}
function safe(value,label){if(typeof value!=="string"||!SAFE.test(value))throw new Error("invalid "+label);return value;}

export function assertProbe(value){
  if(!value||value.format!==FEDERATION_PROBE_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation probe");
  safe(value.requestId,"requestId"); safe(value.jobId,"jobId"); safe(value.originOperatorId,"originOperatorId");
  if(value.targetOperatorId!=="arca-federation-operator-b")throw new Error("unexpected federation target");
  if(value.action!=="worker.ping")throw new Error("federation action not allowed");
  if(value.payloadHash!==sha256({requestId:value.requestId,jobId:value.jobId,action:value.action,params:value.params??{}}))throw new Error("federation payload hash mismatch");
  return true;
}
export function createPingResult(probe,{operatorId="arca-federation-operator-b"}={}){
  assertProbe(probe);
  const result={format:FEDERATION_RESULT_FORMAT,protocolVersion:3,requestId:probe.requestId,jobId:probe.jobId,operatorId,status:"completed",action:"worker.ping",output:{ok:true,echo:probe.params?.echo??null},requestHash:probe.payloadHash};
  return {...result,resultHash:sha256(result)};
}
export function verifyPingResult(value,probe){
  assertProbe(probe);
  if(!value||value.format!==FEDERATION_RESULT_FORMAT||value.protocolVersion!==3)throw new Error("unsupported federation result");
  if(value.requestId!==probe.requestId||value.jobId!==probe.jobId||value.operatorId!=="arca-federation-operator-b")throw new Error("federation result correlation mismatch");
  if(value.status!=="completed"||value.action!=="worker.ping"||value.requestHash!==probe.payloadHash)throw new Error("invalid federation completion");
  const {resultHash,...body}=value;
  if(resultHash!==sha256(body))throw new Error("federation result hash mismatch");
  return true;
}
