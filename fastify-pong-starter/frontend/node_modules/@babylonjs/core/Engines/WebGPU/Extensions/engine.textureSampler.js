import { WebGPUEngine } from "../../webgpuEngine.js";
import { Effect } from "../../../Materials/effect.js";
Effect.prototype.setTextureSampler = function (name, sampler) {
    this._engine.setTextureSampler(name, sampler);
};
WebGPUEngine.prototype.setTextureSampler = function (name, sampler) {
    this._currentMaterialContext?.setSampler(name, sampler);
};
//# sourceMappingURL=engine.textureSampler.js.map