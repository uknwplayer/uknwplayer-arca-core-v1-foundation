import {assertProbe,createFederationResult,MEGA_BRAIN_DISPATCH_ACTION,normalizeMegaBrainTask} from "./protocol.mjs";

export class FederationOperatorB {
  constructor({trustedOrigins=["arca-federation-operator-a"]}={}){
    this.trustedOrigins=new Set(trustedOrigins);
  }
  async receive(probe,{megaBrainOutput}={}){
    assertProbe(probe);
    if(!this.trustedOrigins.has(probe.originOperatorId))throw new Error("untrusted federation origin");
    if(probe.action===MEGA_BRAIN_DISPATCH_ACTION){
      const task=normalizeMegaBrainTask(probe.params.task);
      if(task.assignedNodeId==="node.vince"&&megaBrainOutput===undefined){
        throw new Error("VINCE_COGNITIVE_RESULT_REQUIRED");
      }
    }
    return createFederationResult(probe,{megaBrainOutput});
  }
}
