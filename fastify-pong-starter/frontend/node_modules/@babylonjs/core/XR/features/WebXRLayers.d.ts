import type { WebXRSessionManager } from "../webXRSessionManager";
import { WebXRAbstractFeature } from "./WebXRAbstractFeature";
import type { WebXRLayerWrapper } from "../webXRLayerWrapper";
import { WebXRWebGLLayerWrapper } from "../webXRWebGLLayer";
import { WebXRProjectionLayerWrapper } from "./Layers/WebXRProjectionLayer";
import { WebXRCompositionLayerWrapper } from "./Layers/WebXRCompositionLayer";
import type { DynamicTexture } from "../../Materials/Textures/dynamicTexture.js";
import type { LensFlareSystem } from "../../LensFlares/lensFlareSystem.js";
/**
 * Configuration options of the layers feature
 */
export interface IWebXRLayersOptions {
    /**
     * Whether to try initializing the base projection layer as a multiview render target, if multiview is supported.
     * Defaults to false.
     */
    preferMultiviewOnInit?: boolean;
    /**
     * Optional configuration for the base projection layer.
     */
    projectionLayerInit?: Partial<XRProjectionLayerInit>;
}
/**
 * Exposes the WebXR Layers API.
 */
export declare class WebXRLayers extends WebXRAbstractFeature {
    private readonly _options;
    /**
     * The module's name
     */
    static readonly Name = "xr-layers";
    /**
     * The (Babylon) version of this module.
     * This is an integer representing the implementation version.
     * This number does not correspond to the WebXR specs version
     */
    static readonly Version = 1;
    /**
     * Already-created layers
     */
    private _existingLayers;
    private _glContext;
    private _xrWebGLBinding;
    private _isMultiviewEnabled;
    private _projectionLayerInitialized;
    private _compositionLayerTextureMapping;
    private _layerToRTTProviderMapping;
    constructor(_xrSessionManager: WebXRSessionManager, _options?: IWebXRLayersOptions);
    /**
     * Attach this feature.
     * Will usually be called by the features manager.
     *
     * @returns true if successful.
     */
    attach(): boolean;
    detach(): boolean;
    /**
     * Creates a new XRWebGLLayer.
     * @param params an object providing configuration options for the new XRWebGLLayer
     * @returns the XRWebGLLayer
     */
    createXRWebGLLayer(params?: XRWebGLLayerInit): WebXRWebGLLayerWrapper;
    private _validateLayerInit;
    private _extendXRLayerInit;
    /**
     * Creates a new XRProjectionLayer.
     * @param params an object providing configuration options for the new XRProjectionLayer.
     * @param multiview whether the projection layer should render with multiview. Will be tru automatically if the extension initialized with multiview.
     * @returns the projection layer
     */
    createProjectionLayer(params?: XRProjectionLayerInit, multiview?: boolean): WebXRProjectionLayerWrapper;
    /**
     * Note about making it private - this function will be exposed once I decide on a proper API to support all of the XR layers' options
     * @param options an object providing configuration options for the new XRQuadLayer.
     * @param babylonTexture the texture to display in the layer
     * @returns the quad layer
     */
    private _createQuadLayer;
    /**
     * @experimental
     * This will support full screen ADT when used with WebXR Layers. This API might change in the future.
     * Note that no interaction will be available with the ADT when using this method
     * @param texture the texture to display in the layer
     * @param options optional parameters for the layer
     * @returns a composition layer containing the texture
     */
    addFullscreenAdvancedDynamicTexture(texture: DynamicTexture, options?: {
        distanceFromHeadset: number;
    }): WebXRCompositionLayerWrapper;
    /**
     * @experimental
     * This functions allows you to add a lens flare system to the XR scene.
     * Note - this will remove the lens flare system from the scene and add it to the XR scene.
     * This feature is experimental and might change in the future.
     * @param flareSystem the flare system to add
     * @returns a composition layer containing the flare system
     */
    protected _addLensFlareSystem(flareSystem: LensFlareSystem): WebXRCompositionLayerWrapper;
    /**
     * Add a new layer to the already-existing list of layers
     * @param wrappedLayer the new layer to add to the existing ones
     */
    addXRSessionLayer(wrappedLayer: WebXRLayerWrapper): void;
    /**
     * Sets the layers to be used by the XR session.
     * Note that you must call this function with any layers you wish to render to
     * since it adds them to the XR session's render state
     * (replacing any layers that were added in a previous call to setXRSessionLayers or updateRenderState).
     * This method also sets up the session manager's render target texture provider
     * as the first layer in the array, which feeds the WebXR camera(s) attached to the session.
     * @param wrappedLayers An array of WebXRLayerWrapper, usually returned from the WebXRLayers createLayer functions.
     */
    setXRSessionLayers(wrappedLayers?: Array<WebXRLayerWrapper>): void;
    isCompatible(): boolean;
    /**
     * Dispose this feature and all of the resources attached.
     */
    dispose(): void;
    protected _onXRFrame(_xrFrame: XRFrame): void;
}
