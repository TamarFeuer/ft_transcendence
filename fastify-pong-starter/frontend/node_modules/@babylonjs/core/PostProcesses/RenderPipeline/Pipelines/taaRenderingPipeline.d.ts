import { Camera } from "../../../Cameras/camera";
import { PostProcessRenderPipeline } from "../postProcessRenderPipeline";
import type { Scene } from "../../../scene";
import "../postProcessRenderPipelineManagerSceneComponent";
import "../../../Shaders/taa.fragment";
/**
 * Simple implementation of Temporal Anti-Aliasing (TAA).
 * This can be used to improve image quality for still pictures (screenshots for e.g.).
 */
export declare class TAARenderingPipeline extends PostProcessRenderPipeline {
    /**
     * The TAA PostProcess effect id in the pipeline
     */
    TAARenderEffect: string;
    /**
     * The pass PostProcess effect id in the pipeline
     */
    TAAPassEffect: string;
    private _samples;
    /**
     * Number of accumulated samples (default: 16)
     */
    set samples(samples: number);
    get samples(): number;
    private _msaaSamples;
    /**
     * MSAA samples (default: 1)
     */
    set msaaSamples(samples: number);
    get msaaSamples(): number;
    /**
     * The factor used to blend the history frame with current frame (default: 0.05)
     */
    factor: number;
    /**
     * Disable TAA on camera move (default: true).
     * You generally want to keep this enabled, otherwise you will get a ghost effect when the camera moves (but if it's what you want, go for it!)
     */
    disableOnCameraMove: boolean;
    private _isEnabled;
    /**
     * Gets or sets a boolean indicating if the render pipeline is enabled (default: true).
     */
    get isEnabled(): boolean;
    set isEnabled(value: boolean);
    /**
     * Gets active scene
     */
    get scene(): Scene;
    private _scene;
    private _isDirty;
    private _camerasToBeAttached;
    private _textureType;
    private _taaPostProcess;
    private _passPostProcess;
    private _ping;
    private _pong;
    private _pingpong;
    private _hs;
    private _firstUpdate;
    /**
     * Returns true if TAA is supported by the running hardware
     */
    get isSupported(): boolean;
    /**
     * Constructor of the TAA rendering pipeline
     * @param name The rendering pipeline name
     * @param scene The scene linked to this pipeline
     * @param cameras The array of cameras that the rendering pipeline will be attached to (default: scene.cameras)
     * @param textureType The type of texture where the scene will be rendered (default: Constants.TEXTURETYPE_UNSIGNED_BYTE)
     */
    constructor(name: string, scene: Scene, cameras?: Camera[], textureType?: number);
    /**
     * Get the class name
     * @returns "TAARenderingPipeline"
     */
    getClassName(): string;
    /**
     * Adds a camera to the pipeline
     * @param camera the camera to be added
     */
    addCamera(camera: Camera): void;
    /**
     * Removes a camera from the pipeline
     * @param camera the camera to remove
     */
    removeCamera(camera: Camera): void;
    /**
     * Removes the internal pipeline assets and detaches the pipeline from the scene cameras
     */
    dispose(): void;
    private _createPingPongTextures;
    private _updateEffectDefines;
    private _buildPipeline;
    private _disposePostProcesses;
    private _createTAAPostProcess;
    private _createPassPostProcess;
    /**
     * Serializes the rendering pipeline (Used when exporting)
     * @returns the serialized object
     */
    serialize(): any;
    /**
     * Parse the serialized pipeline
     * @param source Source pipeline.
     * @param scene The scene to load the pipeline to.
     * @param rootUrl The URL of the serialized pipeline.
     * @returns An instantiated pipeline from the serialized object.
     */
    static Parse(source: any, scene: Scene, rootUrl: string): TAARenderingPipeline;
}
