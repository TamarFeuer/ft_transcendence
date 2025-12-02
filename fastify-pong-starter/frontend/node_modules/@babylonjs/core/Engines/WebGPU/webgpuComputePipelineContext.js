/** @internal */
export class WebGPUComputePipelineContext {
    get isAsync() {
        return false;
    }
    get isReady() {
        if (this.stage) {
            return true;
        }
        return false;
    }
    constructor(engine) {
        this._name = "unnamed";
        this.engine = engine;
    }
    _getComputeShaderCode() {
        return this.sources?.compute;
    }
    dispose() { }
}
//# sourceMappingURL=webgpuComputePipelineContext.js.map