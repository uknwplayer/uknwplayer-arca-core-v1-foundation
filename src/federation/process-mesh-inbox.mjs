import {readFile,writeFile,mkdir} from "node:fs/promises";
import {dirname,basename} from "node:path";
import {verifyCanonicalMeshProbe} from "./mesh-adapter.mjs";
import {FederationOperatorB} from "./operator-b.mjs";

const input=process.argv[2];if(!input)throw new Error("arquivo de inbox obrigatório");
const trust=JSON.parse(await readFile(new URL("../../federation/trust/operator-a.json",import.meta.url),"utf8"));
const statement=JSON.parse(await readFile(input,"utf8"));
const probe=verifyCanonicalMeshProbe(statement,{trustedIdentity:trust});
const result=await new FederationOperatorB().receive(probe);
const output=new URL("../../federation/outbox/"+basename(input),import.meta.url);
await mkdir(dirname(output.pathname),{recursive:true});
await writeFile(output,JSON.stringify({...result,evidence:{processor:"operator-b-mesh-adapter-v1",signedStatementHash:statement.statementHash,signerFingerprint:statement.signer.keyFingerprint}},null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({requestId:probe.requestId,status:result.status,resultHash:result.resultHash,statementHash:statement.statementHash,output:output.pathname}));
