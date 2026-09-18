import {readFile,writeFile,mkdir} from "node:fs/promises";
import {dirname,basename} from "node:path";
import {createPrivateKey,createPublicKey,sign} from "node:crypto";
import {verifyCanonicalMeshProbe} from "./mesh-adapter.mjs";
import {createExternalMeshSigner} from "./external-mesh-signer.mjs";
import {FederationOperatorB} from "./operator-b.mjs";

const input=process.argv[2];if(!input)throw new Error("arquivo de inbox obrigatório");
const trust=JSON.parse(await readFile(new URL("../../federation/trust/operator-a.json",import.meta.url),"utf8"));
const statement=JSON.parse(await readFile(input,"utf8"));
const probe=verifyCanonicalMeshProbe(statement,{trustedIdentity:trust});
const result=await new FederationOperatorB().receive(probe);
let persisted={...result,evidence:{processor:"operator-b-mesh-adapter-v1",signedStatementHash:statement.statementHash,signerFingerprint:statement.signer.keyFingerprint}};
const pem=process.env.ARCA_FEDERATION_B_PRIVATE_KEY_PEM;
if(pem){const privateKey=createPrivateKey(pem),publicKey=createPublicKey(privateKey),publicKeySpki=Buffer.from(publicKey.export({type:"spki",format:"der"})).toString("base64");const signer=createExternalMeshSigner({nodeId:"arca-federation-operator-b",publicKeySpki,signBytes:async bytes=>sign(null,bytes,privateKey)});persisted={...persisted,signedEvidence:await signer.signEvidence({type:"federation-result",requestId:probe.requestId,status:result.status,resultHash:result.resultHash,result:result.result},{nonce:probe.requestId.replace(/[^A-Za-z0-9_-]/g,"_").padEnd(16,"_").slice(0,160)})};}
else if(process.env.ARCA_FEDERATION_REQUIRE_SIGNED_RESULT==="1")throw new Error("ARCA_FEDERATION_B_SIGNER_UNAVAILABLE");
const output=new URL("../../federation/outbox/"+basename(input),import.meta.url);await mkdir(dirname(output.pathname),{recursive:true});await writeFile(output,JSON.stringify(persisted,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({requestId:probe.requestId,status:result.status,resultHash:result.resultHash,statementHash:statement.statementHash,signed:Boolean(persisted.signedEvidence),output:output.pathname}));
