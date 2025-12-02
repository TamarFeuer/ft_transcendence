import { WebGPUEngine } from "../../webgpuEngine.js";
import { WebGPURenderItemBeginOcclusionQuery, WebGPURenderItemEndOcclusionQuery } from "../webgpuBundleList.js";
WebGPUEngine.prototype.getGPUFrameTimeCounter = function () {
    return this._timestampQuery.gpuFrameTimeCounter;
};
WebGPUEngine.prototype.captureGPUFrameTime = function (value) {
    this._timestampQuery.enable = value && !!this._caps.timerQuery;
};
WebGPUEngine.prototype.createQuery = function () {
    return this._occlusionQuery.createQuery();
};
WebGPUEngine.prototype.deleteQuery = function (query) {
    this._occlusionQuery.deleteQuery(query);
    return this;
};
WebGPUEngine.prototype.isQueryResultAvailable = function (query) {
    return this._occlusionQuery.isQueryResultAvailable(query);
};
WebGPUEngine.prototype.getQueryResult = function (query) {
    return this._occlusionQuery.getQueryResult(query);
};
WebGPUEngine.prototype.beginOcclusionQuery = function (algorithmType, query) {
    if (this.compatibilityMode) {
        if (this._occlusionQuery.canBeginQuery(query)) {
            this._currentRenderPass?.beginOcclusionQuery(query);
            return true;
        }
    }
    else {
        this._bundleList.addItem(new WebGPURenderItemBeginOcclusionQuery(query));
        return true;
    }
    return false;
};
WebGPUEngine.prototype.endOcclusionQuery = function () {
    if (this.compatibilityMode) {
        this._currentRenderPass?.endOcclusionQuery();
    }
    else {
        this._bundleList.addItem(new WebGPURenderItemEndOcclusionQuery());
    }
    return this;
};
//# sourceMappingURL=engine.query.js.map