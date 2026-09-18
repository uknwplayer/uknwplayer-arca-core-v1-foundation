import {createHash,createPublicKey,verify as cryptoVerify} from "node:crypto";

const SAFE=/^[A-Za-z0-9._-]{1,120}$/;
const NONCE=/^[A-Za-z0-9_-]{16,160}$/;
const HASH=/^[a-f0-9]{64}$/;
export const SIGNED_PROBE_FORMAT="arca-federation-signed-probe-v1";
export const SIGNING_DOMAIN="arca.machine-bridge.federation-probe.v1";

function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
function stringify(v){return JSON.stringify(stable(v))}
function sha(v){return createHash("sha256").update(typeof v==="string"?v:stringify(v)).digest("hex")}
function safe(v,l){if(typeof v!=="string"||!SAFE.test(v))throw new Error("invalid "+l);return v}

export function verifyPublicIdentity(identity,{expectedOperatorId}={}){
  if(!identity||identity.algorithm!=="Ed25519")throw new Error("invalid federation identity");
  safe(identity.operatorId,"operatorId");
  if(expectedOperatorId&&identity.operatorId!==expectedOperatorId)throw new Error("federation identity operator mismatch");
  const key=createPublicKey({key:Buffer.from(identity.publicKeySpki,"base64"),type:"spki",format:"der"});
  if(key.asymmetricKeyType!=="ed25519")throw new Error("federation identity requires Ed25519");
  const fingerprint=sha(Buffer.from(key.export({type:"spki",format:"der"})).toString("base64"));
  if(identity.keyFingerprint!==fingerprint)throw new Error("federation identity fingerprint mismatch");
  return key;
}

export class ReplayGuard{
  #seen=new Set();
  accept(nonce){if(!NONCE.test(nonce||""))throw new Error("invalid federation nonce");if(this.#seen.has(nonce))throw new Error("federation replay detected");this.#seen.add(nonce);return true}
}

export function verifySignedProbe(statement,{trustedIdentity,now=new Date(),replayGuard}={}){
  if(!statement||statement.format!==SIGNED_PROBE_FORMAT||statement.domain!==SIGNING_DOMAIN)throw new Error("unsupported signed federation probe");
  const key=verifyPublicIdentity(statement.signer,{expectedOperatorId:"arca-federation-operator-a"});
  if(!trustedIdentity||trustedIdentity.keyFingerprint!==statement.signer.keyFingerprint)throw new Error("untrusted federation signing key");
  if(!NONCE.test(statement.nonce||""))throw new Error("invalid federation nonce");
  const issued=Date.parse(statement.issuedAt),expires=Date.parse(statement.expiresAt),current=new Date(now).getTime();
  if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||expires-issued>300000)throw new Error("invalid federation validity window");
  if(current<issued||current>=expires)throw new Error("federation signed probe expired or not yet valid");
  if(statement.payloadHash!==sha(statement.payload))throw new Error("federation signed payload hash mismatch");
  const body={format:statement.format,domain:statement.domain,signer:statement.signer,nonce:statement.nonce,issuedAt:statement.issuedAt,expiresAt:statement.expiresAt,payloadHash:statement.payloadHash,payload:statement.payload};
  if(!cryptoVerify(null,Buffer.from("ARCA-FEDERATION-PROBE\0"+stringify(body)),key,Buffer.from(statement.signature,"base64url")))throw new Error("federation signature invalid");
  replayGuard?.accept(statement.nonce);
  return statement.payload;
}
