import {access,mkdir,readdir,readFile,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {createPrivateKey,createPublicKey,sign} from "node:crypto";
import {verifyCanonicalMeshProbe} from "./mesh-adapter.mjs";
import {
  createCanonicalAcceptedEvidence,
  createCanonicalCompletedEvidence
} from "./canonical-evidence.mjs";
import {
  MEGA_BRAIN_DISPATCH_ACTION,
  MEGA_BRAIN_RESULT_SUBMIT_ACTION,
  createMegaBrainResult,
  normalizeMegaBrainDispatchOutput,
  normalizeMegaBrainResultSubmission,
  normalizeMegaBrainTask
} from "./protocol.mjs";

const inboxDir="federation/mesh-inbox";
const authorizationDir="federation/vince-authorizations";
const outboxDir="federation/outbox";
const trust=JSON.parse(await readFile("federation/trust/operator-a.json","utf8"));

const pem=process.env.ARCA_FEDERATION_B_PRIVATE_KEY_PEM;
if(!pem)throw new Error("ARCA_FEDERATION_B_PRIVATE_KEY_PEM required");
const privateKey=createPrivateKey(pem);
const publicKey=createPublicKey(privateKey);
const publicKeySpki=Buffer.from(publicKey.export({type:"spki",format:"der"})).toString("base64");
const signBytes=async bytes=>sign(null,bytes,privateKey);

await mkdir(authorizationDir,{recursive:true});
await mkdir(outboxDir,{recursive:true});

async function exists(path){
  try{await access(path);return true}catch{return false}
}
async function readStatement(path){
  const statement=JSON.parse(await readFile(path,"utf8"));
  const probe=verifyCanonicalMeshProbe(statement,{trustedIdentity:trust});
  return {statement,probe};
}
function ensureVinceOutput(output,task){
  const normalized=normalizeMegaBrainDispatchOutput(output,{task});
  if(!normalized.evidence.some(item=>item.sourceRef.startsWith("vince://cognitive-trace/"))){
    throw new Error("VINCE_COGNITIVE_TRACE_REQUIRED");
  }
  if(normalized.recommendedFollowups.length!==1||
     !normalized.recommendedFollowups[0].requiredCapabilities.includes("research")){
    throw new Error("VINCE_RESEARCH_FOLLOWUP_REQUIRED");
  }
  return normalized;
}

const names=(await readdir(inboxDir)).filter(name=>name.endsWith(".json")).sort();
const processed=[];

for(const name of names){
  const path=join(inboxDir,name);
  let statement,probe;
  try{
    ({statement,probe}=await readStatement(path));
  }catch(error){
    if(String(error?.message||error)==="invalid mesh validity window"){
      processed.push({stage:"stale",file:name});
      continue;
    }
    throw error;
  }

  if(probe.action===MEGA_BRAIN_DISPATCH_ACTION){
    const task=normalizeMegaBrainTask(probe.params.task);
    if(task.assignedNodeId!=="node.vince")continue;

    const authorizationPath=join(authorizationDir,probe.requestId+".json");
    if(await exists(authorizationPath))continue;

    const unsupported=task.requiredCapabilities.filter(
      capability=>!["critique","epistemic-review","synthesis"].includes(capability)
    );
    if(unsupported.length){
      throw new Error("VINCE_UNSUPPORTED_CAPABILITIES:"+unsupported.join(","));
    }

    const accepted=await createCanonicalAcceptedEvidence({
      probe,
      publicKeySpki,
      signBytes
    });
    const authorization={
      format:"arca-federated-vince-authorization-v1",
      version:1,
      requestId:probe.requestId,
      jobId:probe.jobId,
      payloadHash:probe.payloadHash,
      ownerBindingHash:probe.ownerBindingHash,
      requestStatementHash:statement.statementHash,
      logicalNodeId:task.assignedNodeId,
      accepted
    };
    await writeFile(
      authorizationPath,
      JSON.stringify(authorization,null,2)+"\n",
      {flag:"wx"}
    );
    processed.push({stage:"accepted",requestId:probe.requestId,authorizationPath});
    continue;
  }

  if(probe.action===MEGA_BRAIN_RESULT_SUBMIT_ACTION){
    const submission=normalizeMegaBrainResultSubmission(probe.params);
    const finalPath=join(outboxDir,submission.originalRequestId+".json");
    if(await exists(finalPath))continue;

    const originalPath=join(inboxDir,submission.originalRequestId+".json");
    const authorizationPath=join(authorizationDir,submission.originalRequestId+".json");
    if(!(await exists(originalPath)))throw new Error("ORIGINAL_VINCE_REQUEST_MISSING");
    if(!(await exists(authorizationPath)))throw new Error("VINCE_AUTHORIZATION_MISSING");

    const {statement:originalStatement,probe:originalProbe}=await readStatement(originalPath);
    if(originalProbe.action!==MEGA_BRAIN_DISPATCH_ACTION)throw new Error("ORIGINAL_ACTION_MISMATCH");
    const originalTask=normalizeMegaBrainTask(originalProbe.params.task);
    if(originalTask.assignedNodeId!=="node.vince")throw new Error("ORIGINAL_LOGICAL_NODE_MISMATCH");

    const authorization=JSON.parse(await readFile(authorizationPath,"utf8"));
    if(authorization.format!=="arca-federated-vince-authorization-v1"||authorization.version!==1){
      throw new Error("INVALID_VINCE_AUTHORIZATION");
    }
    if(authorization.requestId!==originalProbe.requestId||
       authorization.jobId!==originalProbe.jobId||
       authorization.payloadHash!==originalProbe.payloadHash||
       authorization.ownerBindingHash!==originalProbe.ownerBindingHash||
       authorization.requestStatementHash!==originalStatement.statementHash){
      throw new Error("VINCE_AUTHORIZATION_BINDING_MISMATCH");
    }
    if(submission.originalRequestId!==originalProbe.requestId||
       submission.originalJobId!==originalProbe.jobId||
       submission.originalPayloadHash!==originalProbe.payloadHash||
       submission.ownerBindingHash!==originalProbe.ownerBindingHash||
       submission.acceptedStatementHash!==authorization.accepted?.statementHash){
      throw new Error("VINCE_RESULT_SUBMISSION_BINDING_MISMATCH");
    }

    const output=ensureVinceOutput(submission.megaBrainOutput,originalTask);
    const result=createMegaBrainResult(originalProbe,{megaBrainOutput:output});
    const completed=await createCanonicalCompletedEvidence({
      probe:originalProbe,
      result,
      accepted:authorization.accepted,
      publicKeySpki,
      signBytes
    });

    const persisted={
      ...result,
      evidence:{
        processor:"operator-b-federated-vince-gateway-v1",
        originalRequestStatementHash:originalStatement.statementHash,
        resultSubmissionStatementHash:statement.statementHash,
        resultSubmitSignerFingerprint:statement.signer.keyFingerprint
      },
      canonicalEvidence:{
        accepted:authorization.accepted,
        completed
      },
      delegationEvidence:{
        format:"arca-federated-vince-delegation-v1",
        version:1,
        authorizationStatementHash:authorization.accepted.statementHash,
        resultSubmissionStatementHash:statement.statementHash,
        cognitiveEvidenceSource:output.evidence.find(item=>item.sourceRef.startsWith("vince://cognitive-trace/")).sourceRef
      }
    };
    await writeFile(finalPath,JSON.stringify(persisted,null,2)+"\n",{flag:"wx"});
    processed.push({
      stage:"completed",
      requestId:originalProbe.requestId,
      submissionRequestId:probe.requestId,
      resultHash:result.resultHash,
      finalPath
    });
  }
}

if(!processed.length){
  console.log(JSON.stringify({ok:true,processed:[],message:"no pending federated Vince gateway work"},null,2));
}else{
  console.log(JSON.stringify({ok:true,processed},null,2));
}
