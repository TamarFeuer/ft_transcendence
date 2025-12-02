import type { ISceneLoaderPluginAsync, ISceneLoaderPluginFactory, ISceneLoaderPlugin, ISceneLoaderAsyncResult, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader.js";
import type { AssetContainer } from "@babylonjs/core/assetContainer.js";
import type { Scene } from "@babylonjs/core/scene.js";
/**
 * @experimental
 * SPLAT file type loader.
 * This is a babylon scene loader plugin.
 */
export declare class SPLATFileLoader implements ISceneLoaderPluginAsync, ISceneLoaderPluginFactory {
    /**
     * Defines the name of the plugin.
     */
    name: string;
    /**
     * Defines the extensions the splat loader is able to load.
     * force data to come in as an ArrayBuffer
     */
    extensions: ISceneLoaderPluginExtensions;
    /**
     * Creates loader for gaussian splatting files
     */
    constructor();
    /**
     * Instantiates a gaussian splatting file loader plugin.
     * @returns the created plugin
     */
    createPlugin(): ISceneLoaderPluginAsync | ISceneLoaderPlugin;
    /**
     * If the data string can be loaded directly.
     * @returns if the data can be loaded directly
     */
    canDirectLoad(): boolean;
    /**
     * Imports  from the loaded gaussian splatting data and adds them to the scene
     * @param _meshesNames a string or array of strings of the mesh names that should be loaded from the file
     * @param scene the scene the meshes should be added to
     * @param data the gaussian splatting data to load
     * @param rootUrl root url to load from
     * @param onProgress callback called while file is loading
     * @param fileName Defines the name of the file to load
     * @returns a promise containing the loaded meshes, particles, skeletons and animations
     */
    importMeshAsync(_meshesNames: any, scene: Scene, data: any, rootUrl: string, onProgress?: (event: ISceneLoaderProgressEvent) => void, fileName?: string): Promise<ISceneLoaderAsyncResult>;
    /**
     * Imports all objects from the loaded gaussian splatting data and adds them to the scene
     * @param scene the scene the objects should be added to
     * @param data the gaussian splatting data to load
     * @param _rootUrl root url to load from
     * @returns a promise which completes when objects have been loaded to the scene
     */
    loadAsync(scene: Scene, data: any, _rootUrl: string): Promise<void>;
    /**
     * Load into an asset container.
     * @param _scene The scene to load into
     * @param _data The data to import
     * @param _rootUrl The root url for scene and resources
     * @returns The loaded asset container
     */
    loadAssetContainerAsync(_scene: Scene, _data: string, _rootUrl: string): Promise<AssetContainer>;
}
