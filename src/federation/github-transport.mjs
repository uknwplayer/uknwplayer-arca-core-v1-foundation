const REPO="uknwplayer/uknwplayer-arca-core-v1-foundation";
const SAFE=/^[A-Za-z0-9._-]{1,120}$/;

function safe(v,l){if(typeof v!=="string"||!SAFE.test(v))throw new Error("invalid "+l);return v}

export function federationInboxPath({requestId}={}){return "federation/inbox/"+safe(requestId,"requestId")+".json"}
export function federationOutboxPath({requestId}={}){return "federation/outbox/"+safe(requestId,"requestId")+".json"}

export function createGitHubFederationTransport({repository=REPO,readFile,createFile}={}){
 if(repository!==REPO)throw new Error("unexpected federation repository");
 if(typeof readFile!=="function"||typeof createFile!=="function")throw new TypeError("GitHub federation transport adapters required");
 return Object.freeze({
   repository,
   async receive(requestId){
     const path=federationInboxPath({requestId});
     const value=await readFile({repository,path});
     if(!value)throw new Error("federation request not found");
     return typeof value==="string"?JSON.parse(value):value;
   },
   async publishResult(requestId,result){
     const path=federationOutboxPath({requestId});
     await createFile({repository,path,content:JSON.stringify(result,null,2)+"\n"});
     return Object.freeze({repository,path,requestId});
   }
 });
}
