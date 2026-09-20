import {readFile,writeFile,mkdir} from "node:fs/promises";
import {dirname,basename} from "node:path";
import {createPrivateKey,createPublicKey,sign} from "node:crypto";
import {verifyCanonicalMeshProbe} from "./mesh-adapter.mjs";
import {createCanonicalCompletionEvidence} from "./canonical-evidence.mjs";
import {FederationOperatorB} from "./operator-b.mjs";

const input=process.argv[2];if(!input)throw new Error("arquivo de inbox obrigatório");
const trust=JSON.parse(await readFile(new URL("../../federation/trust/operator-a.json",import.meta.url),"utf8"));
const statement=JSON.parse(await readFile(input,"utf8"));
const probe=verifyCanonicalMeshProbe(statement,{trustedIdentity:trust});

let megaBrainOutput;
const resultFile=process.env.ARCA_FEDERATED_MEGA_BRAIN_RESULT_FILE;
if(resultFile){
  megaBrainOutput=JSON.parse(await readFile(resultFile,"utf8"));
}
const result=await new FederationOperatorB().receive(probe,{megaBrainOutput});
let persisted={...result,evidence:{processor:"operator-b-mesh-adapter-v1",signedStatementHash:statement.statementHash,signerFingerprint:statement.signer.keyFingerprint}};
const pem=process.env.ARCA_FEDERATION_B_PRIVATE_KEY_PEM;
if(pem){
  const privateKey=createPrivateKey(pem),publicKey=createPublicKey(privateKey);
  const publicKeySpki=Buffer.from(publicKey.export({type:"spki",format:"der"})).toString("base64");
  persisted={...persisted,canonicalEvidence:await createCanonicalCompletionEvidence({probe,result,publicKeySpki,signBytes:async bytes=>sign(null,bytes,privateKey)})};
}else if(process.env.ARCA_FEDERATION_REQUIRE_SIGNED_RESULT==="1")throw new Error("ARCA_FEDERATION_B_SIGNER_UNAVAILABLE");
const output=new URL("../../federation/outbox/"+basename(input),import.meta.url);
await mkdir(dirname(output.pathname),{recursive:true});
await writeFile(output,JSON.stringify(persisted,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({
  requestId:probe.requestId,
  status:result.status,
  action:result.action,
  logicalNodeId:result.output?.nodeId??null,
  resultHash:result.resultHash,
  megaBrainResultId:result.output?.resultId??null,
  statementHash:statement.statementHash,
  signed:Boolean(persisted.canonicalEvidence),
  canonicalEvidence:Boolean(persisted.canonicalEvidence),
  output:output.pathname
}));
