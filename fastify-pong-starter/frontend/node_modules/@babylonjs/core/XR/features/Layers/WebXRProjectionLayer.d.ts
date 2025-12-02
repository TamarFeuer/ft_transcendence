import { WebXRCompositionLayerWrapper } from "./WebXRCompositionLayer";
/**
 * Wraps xr projection layers.
 * @internal
 */
export declare class WebXRProjectionLayerWrapper extends WebXRCompositionLayerWrapper {
    readonly layer: XRProjectionLayer;
    constructor(layer: XRProjectionLayer, isMultiview: boolean, xrGLBinding: XRWebGLBinding);
}
export declare const defaultXRProjectionLayerInit: XRProjectionLayerInit;
