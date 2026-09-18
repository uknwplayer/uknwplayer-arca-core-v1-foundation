import {createHash,createPublicKey,verify as cryptoVerify} from "node:crypto";
export const MESH_REQUEST_EVIDENCE_DOMAIN="arca.mesh.request-evidence.v1";
const stable=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(stable(x))):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,JSON.parse(stable(v[k]))])):v);
const sha=v=>createHash("sha256").update(Buffer.isBuffer(v)?v:typeof v==="string"?v:stable(v)).digest("hex");
const bytes=b=>Buffer.from("ARCA-MESH-SIGNED-STATEMENT\0"+stable(b),"utf8");
export function createExternalMeshSigner({nodeId,publicKeySpki,signBytes}={}){
 if(typeof signBytes!=="function")throw new TypeError("signBytes externo obrigatório");
 const key=createPublicKey({key:Buffer.from(publicKeySpki,"base64"),type:"spki",format:"der"});if(key.asymmetricKeyType!=="ed25519")throw new Error("Ed25519 obrigatório");
 const der=Buffer.from(key.export({type:"spki",format:"der"})),fp=sha(der);const identity={format:"arca-mesh-node-identity-v1",version:1,algorithm:"Ed25519",nodeId,identityId:"ed25519:"+fp,keyFingerprint:fp,publicKeySpki:der.toString("base64")};identity.descriptorHash=sha(identity);
 return Object.freeze({identity,async signEvidence(payload,{nonce,issuedAt=new Date(),ttlMs=300000}={}){if(!/^[A-Za-z0-9_-]{16,160}$/.test(nonce||""))throw new Error("nonce Mesh inválido");const issued=new Date(issuedAt);const body={format:"arca-mesh-signed-statement-v1",version:1,domain:MESH_REQUEST_EVIDENCE_DOMAIN,signer:identity,nonce,issuedAt:issued.toISOString(),expiresAt:new Date(issued.getTime()+ttlMs).toISOString(),payloadHash:sha(payload),payload};const signature=Buffer.from(await signBytes(bytes(body)));if(!cryptoVerify(null,bytes(body),key,signature))throw new Error("ARCA_FEDERATION_B_SIGNER_POSSESSION_FAILED");const statement={...body,signature:signature.toString("base64url")};return Object.freeze({...statement,statementHash:sha(statement)});}});
}
