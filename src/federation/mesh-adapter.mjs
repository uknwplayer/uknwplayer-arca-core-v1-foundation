import {createHash,createPublicKey,verify as cryptoVerify} from "node:crypto";
import {assertProbe} from "./protocol.mjs";

export const MESH_SIGNED_STATEMENT_FORMAT="arca-mesh-signed-statement-v1";
export const MESH_REQUEST_EVIDENCE_DOMAIN="arca.mesh.request-evidence.v1";
const SAFE_NONCE=/^[A-Za-z0-9_-]{16,160}$/;
function canonicalize(v){if(Array.isArray(v))return v.map(canonicalize);if(v&&typeof v==="object"){const o={};for(const k of Object.keys(v).sort())if(v[k]!==undefined)o[k]=canonicalize(v[k]);return o}return v}
const stable=v=>JSON.stringify(canonicalize(v));
const sha=v=>createHash("sha256").update(Buffer.isBuffer(v)?v:typeof v==="string"?v:stable(v)).digest("hex");
const signingBytes=b=>Buffer.from("ARCA-MESH-SIGNED-STATEMENT\0"+stable(b),"utf8");

export function verifyCanonicalMeshProbe(statement,{trustedIdentity,now=new Date()}={}){
 if(!statement||statement.format!==MESH_SIGNED_STATEMENT_FORMAT||statement.version!==1||statement.domain!==MESH_REQUEST_EVIDENCE_DOMAIN)throw new Error("unsupported canonical mesh probe");
 if(!SAFE_NONCE.test(statement.nonce||""))throw new Error("invalid mesh nonce");
 const signer=statement.signer;if(!signer||signer.format!=="arca-mesh-node-identity-v1"||signer.algorithm!=="Ed25519")throw new Error("invalid mesh signer");
 if(!trustedIdentity||trustedIdentity.keyFingerprint!==signer.keyFingerprint)throw new Error("untrusted mesh signing key");
 const key=createPublicKey({key:Buffer.from(signer.publicKeySpki,"base64"),type:"spki",format:"der"});
 if(sha(Buffer.from(key.export({type:"spki",format:"der"})))!==signer.keyFingerprint)throw new Error("mesh signer fingerprint mismatch");
 const issued=Date.parse(statement.issuedAt),expires=Date.parse(statement.expiresAt),current=new Date(now).getTime();
 if(!Number.isFinite(issued)||!Number.isFinite(expires)||expires<=issued||expires-issued>86400000||current<issued-60000||current>=expires+60000)throw new Error("invalid mesh validity window");
 if(statement.payloadHash!==sha(statement.payload))throw new Error("mesh payload hash mismatch");
 const {signature,statementHash,...body}=statement;
 if(!cryptoVerify(null,signingBytes(body),key,Buffer.from(signature,"base64url")))throw new Error("mesh signature invalid");
 if(statementHash!==sha({...body,signature}))throw new Error("mesh statement hash mismatch");
 assertProbe(statement.payload);
 return statement.payload;
}

export function canonicalMeshToLegacyProbe(statement,options){return verifyCanonicalMeshProbe(statement,options)}
