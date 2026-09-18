import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,createHash,sign} from "node:crypto";
import {ReplayGuard,verifySignedProbe} from "../src/federation/identity.mjs";

function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==="object")return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v}
const stringify=v=>JSON.stringify(stable(v));
const sha=v=>createHash("sha256").update(typeof v==="string"?v:stringify(v)).digest("hex");
function fixture(){
 const {publicKey,privateKey}=generateKeyPairSync("ed25519");
 const der=Buffer.from(publicKey.export({type:"spki",format:"der"}));
 const identity={operatorId:"arca-federation-operator-a",algorithm:"Ed25519",keyFingerprint:sha(der.toString("base64")),publicKeySpki:der.toString("base64")};
 const payload={format:"arca-federation-probe-v1",protocolVersion:3,requestId:"req-signed-001",jobId:"job-signed-001",originOperatorId:identity.operatorId,targetOperatorId:"arca-federation-operator-b",action:"worker.ping",params:{echo:"real-boundary"}};
 const issuedAt="2026-09-18T06:30:00.000Z",expiresAt="2026-09-18T06:31:00.000Z";
 const body={format:"arca-federation-signed-probe-v1",domain:"arca.machine-bridge.federation-probe.v1",signer:identity,nonce:"federationnonce0001",issuedAt,expiresAt,payloadHash:sha(payload),payload};
 return {statement:{...body,signature:sign(null,Buffer.from("ARCA-FEDERATION-PROBE\0"+stringify(body)),privateKey).toString("base64url")},identity};
}
test("B aceita assinatura Ed25519 explicitamente confiada",()=>{const {statement,identity}=fixture();assert.equal(verifySignedProbe(statement,{trustedIdentity:identity,now:new Date("2026-09-18T06:30:30Z")}).action,"worker.ping")});
test("B rejeita replay",()=>{const {statement,identity}=fixture();const guard=new ReplayGuard();verifySignedProbe(statement,{trustedIdentity:identity,now:new Date("2026-09-18T06:30:30Z"),replayGuard:guard});assert.throws(()=>verifySignedProbe(statement,{trustedIdentity:identity,now:new Date("2026-09-18T06:30:30Z"),replayGuard:guard}),/replay detected/)});
test("B rejeita chave não pinada",()=>{const a=fixture(),b=fixture();assert.throws(()=>verifySignedProbe(a.statement,{trustedIdentity:b.identity,now:new Date("2026-09-18T06:30:30Z")}),/untrusted federation signing key/)});
test("B rejeita adulteração",()=>{const {statement,identity}=fixture();assert.throws(()=>verifySignedProbe({...statement,payload:{...statement.payload,action:"shell.exec"}},{trustedIdentity:identity,now:new Date("2026-09-18T06:30:30Z")}),/payload hash mismatch|signature invalid/)});
