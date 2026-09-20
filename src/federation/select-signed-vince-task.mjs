import {readdir,readFile,writeFile,access} from "node:fs/promises";
import {join,basename} from "node:path";
import {verifyCanonicalMeshProbe} from "./mesh-adapter.mjs";
import {MEGA_BRAIN_DISPATCH_ACTION,normalizeMegaBrainTask} from "./protocol.mjs";

const output=process.argv[2]||"vince-task.json";
const inboxDir="federation/mesh-inbox";
const outboxDir="federation/outbox";
const trust=JSON.parse(await readFile("federation/trust/operator-a.json","utf8"));
const allowed=new Set(["critique","epistemic-review","synthesis"]);

const names=(await readdir(inboxDir)).filter(name=>name.endsWith(".json")).sort();
let selected=null;
let task=null;
for(const name of names){
  const out=join(outboxDir,name);
  try{await access(out);continue;}catch{}
  const statement=JSON.parse(await readFile(join(inboxDir,name),"utf8"));
  const probe=verifyCanonicalMeshProbe(statement,{trustedIdentity:trust});
  if(probe.action!==MEGA_BRAIN_DISPATCH_ACTION)continue;
  const candidate=normalizeMegaBrainTask(probe.params.task);
  if(candidate.assignedNodeId!=="node.vince")continue;
  const unsupported=candidate.requiredCapabilities.filter(cap=>!allowed.has(cap));
  if(unsupported.length)throw new Error("VINCE_UNSUPPORTED_CAPABILITIES:"+unsupported.join(","));
  selected=join(inboxDir,name);
  task=candidate;
  break;
}
if(!selected||!task)throw new Error("NO_PENDING_SIGNED_VINCE_TASK");

await writeFile(output,JSON.stringify(task,null,2)+"\n","utf8");
if(process.env.GITHUB_OUTPUT){
  await writeFile(process.env.GITHUB_OUTPUT,`inbox=${selected}\nrequest_id=${basename(selected,".json")}\n`,{flag:"a"});
}
console.log(JSON.stringify({
  selected,
  taskFile:output,
  missionId:task.missionId,
  taskId:task.taskId,
  logicalNodeId:task.assignedNodeId,
  requiredCapabilities:task.requiredCapabilities
},null,2));
