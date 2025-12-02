import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader.js";
import { GaussianSplattingMesh } from "@babylonjs/core/Meshes/GaussianSplatting/gaussianSplattingMesh.js";
/**
 * @experimental
 * SPLAT file type loader.
 * This is a babylon scene loader plugin.
 */
export class SPLATFileLoader {
    //private _loadingOptions: SPLATLoadingOptions;
    /**
     * Creates loader for gaussian splatting files
     */
    constructor() {
        /**
         * Defines the name of the plugin.
         */
        this.name = "splat";
        /**
         * Defines the extensions the splat loader is able to load.
         * force data to come in as an ArrayBuffer
         */
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".splat": { isBinary: true },
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".ply": { isBinary: true },
        };
    }
    /**
     * Instantiates a gaussian splatting file loader plugin.
     * @returns the created plugin
     */
    createPlugin() {
        return new SPLATFileLoader();
    }
    /**
     * If the data string can be loaded directly.
     * @returns if the data can be loaded directly
     */
    canDirectLoad() {
        return false;
    }
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
    async importMeshAsync(_meshesNames, scene, data, rootUrl, onProgress, fileName) {
        const gaussianSplatting = new GaussianSplattingMesh("GaussianSplatting", null, scene);
        await gaussianSplatting.loadFileAsync(rootUrl + (fileName ?? ""));
        return {
            meshes: [gaussianSplatting],
            particleSystems: [],
            skeletons: [],
            animationGroups: [],
            transformNodes: [],
            geometries: [],
            lights: [],
            spriteManagers: [],
        };
    }
    /**
     * Imports all objects from the loaded gaussian splatting data and adds them to the scene
     * @param scene the scene the objects should be added to
     * @param data the gaussian splatting data to load
     * @param _rootUrl root url to load from
     * @returns a promise which completes when objects have been loaded to the scene
     */
    loadAsync(scene, data, _rootUrl) {
        const gaussianSplatting = new GaussianSplattingMesh("GaussianSplatting", null, scene);
        return gaussianSplatting.loadDataAsync(GaussianSplattingMesh.ConvertPLYToSplat(data));
    }
    // eslint-disable-next-line jsdoc/require-returns-check
    /**
     * Load into an asset container.
     * @param _scene The scene to load into
     * @param _data The data to import
     * @param _rootUrl The root url for scene and resources
     * @returns The loaded asset container
     */
    loadAssetContainerAsync(_scene, _data, _rootUrl) {
        throw new Error("loadAssetContainerAsync not implemented for Gaussian Splatting loading");
    }
}
if (SceneLoader) {
    //Add this loader into the register plugin
    SceneLoader.RegisterPlugin(new SPLATFileLoader());
}
//# sourceMappingURL=splatFileLoader.js.map