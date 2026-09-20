import {createHash} from "node:crypto";
import {createExternalMeshSigner} from "./external-mesh-signer.mjs";

const HASH=/^[a-f0-9]{64}$/;
const SAFE=/^[A-Za-z0-9._-]{1,120}$/;
const FORMAT="arca-remote-request-evidence-v1";
const stable=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,JSON.parse(stable(v[k]))])):v);
const sha=v=>createHash("sha256").update(typeof v==="string"?v:stable(v)).digest("hex");
function id(v,n){if(typeof v!=="string"||!SAFE.test(v))throw new Error("invalid "+n);return v}
function hash(v,n){if(typeof v!=="string"||!HASH.test(v))throw new Error("invalid "+n);return v}
function nonce(requestId,stage){return (requestId+"_"+stage).replace(/[^A-Za-z0-9_-]/g,"_").padEnd(16,"_").slice(0,160)}
function common(probe,stage,at){
  return {format:FORMAT,version:1,stage,nodeId:"arca-federation-operator-b",requestId:id(probe.requestId,"requestId"),jobId:id(probe.jobId,"jobId"),payloadHash:hash(probe.payloadHash,"payloadHash"),ownerBindingHash:hash(probe.ownerBindingHash,"ownerBindingHash"),evidenceAt:new Date(at).toISOString()};
}
function signerFor({publicKeySpki,signBytes}={}){
  return createExternalMeshSigner({nodeId:"arca-federation-operator-b",publicKeySpki,signBytes});
}

export async function createCanonicalAcceptedEvidence({probe,publicKeySpki,signBytes,now=new Date()}={}){
  const signer=signerFor({publicKeySpki,signBytes});
  const acceptedPayload=common(probe,"accepted",now);
  return signer.signEvidence(acceptedPayload,{nonce:nonce(probe.requestId,"accepted"),issuedAt:now});
}

export async function createCanonicalCompletedEvidence({probe,result,accepted,publicKeySpki,signBytes,now=new Date()}={}){
  if(!result||result.status!=="completed")throw new Error("completed federation result required");
  hash(result.resultHash,"resultHash");
  if(!accepted||typeof accepted.statementHash!=="string")throw new Error("accepted federation evidence required");
  hash(accepted.statementHash,"acceptedStatementHash");
  const signer=signerFor({publicKeySpki,signBytes});
  const completedPayload={...common(probe,"completed",now),resultHash:result.resultHash,acceptedStatementHash:accepted.statementHash};
  return signer.signEvidence(completedPayload,{nonce:nonce(probe.requestId,"completed"),issuedAt:now});
}

export async function createCanonicalCompletionEvidence({probe,result,publicKeySpki,signBytes,now=new Date()}={}){
  const accepted=await createCanonicalAcceptedEvidence({probe,publicKeySpki,signBytes,now});
  const completed=await createCanonicalCompletedEvidence({probe,result,accepted,publicKeySpki,signBytes,now});
  return Object.freeze({accepted,completed});
}
export function federationProbePayloadHash({requestId,jobId,action,params}={}){
  return sha({requestId,jobId,action,params:params??{}});
}
