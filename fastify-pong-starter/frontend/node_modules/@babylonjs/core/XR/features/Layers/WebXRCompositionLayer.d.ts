import type { InternalTexture } from "../../../Materials/Textures/internalTexture.js";
import type { RenderTargetTexture } from "../../../Materials/Textures/renderTargetTexture.js";
import type { Viewport } from "../../../Maths/math.viewport.js";
import { Observable } from "../../../Misc/observable.js";
import type { WebXRLayerType } from "../../webXRLayerWrapper.js";
import { WebXRLayerWrapper } from "../../webXRLayerWrapper.js";
import { WebXRLayerRenderTargetTextureProvider } from "../../webXRRenderTargetTextureProvider.js";
import type { WebXRSessionManager } from "../../webXRSessionManager.js";
import type { Nullable } from "../../../types.js";
/**
 * Wraps xr composition layers.
 * @internal
 */
export declare class WebXRCompositionLayerWrapper extends WebXRLayerWrapper {
    getWidth: () => number;
    getHeight: () => number;
    readonly layer: XRCompositionLayer;
    readonly layerType: WebXRLayerType;
    readonly isMultiview: boolean;
    createRTTProvider: (xrSessionManager: WebXRSessionManager) => WebXRLayerRenderTargetTextureProvider;
    _originalInternalTexture: Nullable<InternalTexture>;
    constructor(getWidth: () => number, getHeight: () => number, layer: XRCompositionLayer, layerType: WebXRLayerType, isMultiview: boolean, createRTTProvider: (xrSessionManager: WebXRSessionManager) => WebXRLayerRenderTargetTextureProvider, _originalInternalTexture?: Nullable<InternalTexture>);
}
/**
 * Provides render target textures and other important rendering information for a given XRCompositionLayer.
 * @internal
 */
export declare class WebXRCompositionLayerRenderTargetTextureProvider extends WebXRLayerRenderTargetTextureProvider {
    protected readonly _xrSessionManager: WebXRSessionManager;
    protected readonly _xrWebGLBinding: XRWebGLBinding;
    readonly layerWrapper: WebXRCompositionLayerWrapper;
    protected _lastSubImages: Map<XREye, XRWebGLSubImage>;
    private _compositionLayer;
    /**
     * Fires every time a new render target texture is created (either for eye, for view, or for the entire frame)
     */
    onRenderTargetTextureCreatedObservable: Observable<{
        texture: RenderTargetTexture;
        eye?: XREye | undefined;
    }>;
    constructor(_xrSessionManager: WebXRSessionManager, _xrWebGLBinding: XRWebGLBinding, layerWrapper: WebXRCompositionLayerWrapper);
    protected _getRenderTargetForSubImage(subImage: XRWebGLSubImage, eye?: XREye): RenderTargetTexture;
    private _getSubImageForEye;
    getRenderTargetTextureForEye(eye?: XREye): Nullable<RenderTargetTexture>;
    getRenderTargetTextureForView(view?: XRView): Nullable<RenderTargetTexture>;
    protected _setViewportForSubImage(viewport: Viewport, subImage: XRWebGLSubImage): void;
    trySetViewportForView(viewport: Viewport, view: XRView): boolean;
}
