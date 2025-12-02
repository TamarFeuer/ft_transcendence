import type { Scene } from "../../scene.js";
import type { Nullable } from "../../types.js";
import type { BaseTexture } from "../../Materials/Textures/baseTexture.js";
import { SubMesh } from "../subMesh";
import type { AbstractMesh } from "../abstractMesh";
import { Mesh } from "../mesh";
/**
 * Class used to render a gaussian splatting mesh
 */
export declare class GaussianSplattingMesh extends Mesh {
    private _vertexCount;
    private _worker;
    private _frameIdLastUpdate;
    private _modelViewMatrix;
    private _material;
    private _depthMix;
    private _canPostToWorker;
    private _lastProj;
    private _covariancesATexture;
    private _covariancesBTexture;
    private _centersTexture;
    private _colorsTexture;
    /**
     * Gets the covariancesA texture
     */
    get covariancesATexture(): Nullable<BaseTexture>;
    /**
     * Gets the covariancesB texture
     */
    get covariancesBTexture(): Nullable<BaseTexture>;
    /**
     * Gets the centers texture
     */
    get centersTexture(): Nullable<BaseTexture>;
    /**
     * Gets the colors texture
     */
    get colorsTexture(): Nullable<BaseTexture>;
    /**
     * Creates a new gaussian splatting mesh
     * @param name defines the name of the mesh
     * @param url defines the url to load from (optional)
     * @param scene defines the hosting scene (optional)
     */
    constructor(name: string, url?: Nullable<string>, scene?: Nullable<Scene>);
    /**
     * Returns the class name
     * @returns "GaussianSplattingMesh"
     */
    getClassName(): string;
    /**
     * Returns the total number of vertices (splats) within the mesh
     * @returns the total number of vertices
     */
    getTotalVertices(): number;
    /**
     * Triggers the draw call for the mesh. Usually, you don't need to call this method by your own because the mesh rendering is handled by the scene rendering manager
     * @param subMesh defines the subMesh to render
     * @param enableAlphaMode defines if alpha mode can be changed
     * @param effectiveMeshReplacement defines an optional mesh used to provide info for the rendering
     * @returns the current mesh
     */
    render(subMesh: SubMesh, enableAlphaMode: boolean, effectiveMeshReplacement?: AbstractMesh): Mesh;
    /**
     * Code from https://github.com/dylanebert/gsplat.js/blob/main/src/loaders/PLYLoader.ts Under MIT license
     * Converts a .ply data array buffer to splat
     * if data array buffer is not ply, returns the original buffer
     * @param data the .ply data to load
     * @returns the loaded splat buffer
     */
    static ConvertPLYToSplat(data: ArrayBuffer): ArrayBuffer;
    /**
     * Loads a .splat Gaussian Splatting array buffer asynchronously
     * @param data arraybuffer containing splat file
     * @returns a promise that resolves when the operation is complete
     */
    loadDataAsync(data: ArrayBuffer): Promise<void>;
    /**
     * Loads a .splat Gaussian or .ply Splatting file asynchronously
     * @param url path to the splat file to load
     * @returns a promise that resolves when the operation is complete
     */
    loadFileAsync(url: string): Promise<void>;
    /**
     * Releases resources associated with this mesh.
     * @param doNotRecurse Set to true to not recurse into each children (recurse into each children by default)
     */
    dispose(doNotRecurse?: boolean): void;
    private static _CreateWorker;
    private _loadData;
    private _getTextureSize;
}
