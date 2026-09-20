import {assertProbe,createFederationResult} from "./protocol.mjs";

export class FederationOperatorB {
  constructor({trustedOrigins=["arca-federation-operator-a"]}={}){
    this.trustedOrigins=new Set(trustedOrigins);
  }
  async receive(probe){
    assertProbe(probe);
    if(!this.trustedOrigins.has(probe.originOperatorId))throw new Error("untrusted federation origin");
    return createFederationResult(probe);
  }
}
