/** @internal */
export class DrawWrapper {
    static IsWrapper(effect) {
        return effect.getPipelineContext === undefined;
    }
    static GetEffect(effect) {
        return effect.getPipelineContext === undefined ? effect.effect : effect;
    }
    constructor(engine, createMaterialContext = true) {
        /**
         * @internal
         * Specifies if the effect was previously ready
         */
        this._wasPreviouslyReady = false;
        /**
         * @internal
         * Forces the code from bindForSubMesh to be fully run the next time it is called
         */
        this._forceRebindOnNextCall = true;
        /**
         * @internal
         * Specifies if the effect was previously using instances
         */
        this._wasPreviouslyUsingInstances = null;
        this.effect = null;
        this.defines = null;
        this.drawContext = engine.createDrawContext();
        if (createMaterialContext) {
            this.materialContext = engine.createMaterialContext();
        }
    }
    setEffect(effect, defines, resetContext = true) {
        this.effect = effect;
        if (defines !== undefined) {
            this.defines = defines;
        }
        if (resetContext) {
            this.drawContext?.reset();
        }
    }
    dispose() {
        this.drawContext?.dispose();
    }
}
//# sourceMappingURL=drawWrapper.js.map