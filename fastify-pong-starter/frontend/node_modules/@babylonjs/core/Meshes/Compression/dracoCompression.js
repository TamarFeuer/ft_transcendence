/* eslint-disable @typescript-eslint/naming-convention */
import { Tools } from "../../Misc/tools.js";
import { AutoReleaseWorkerPool } from "../../Misc/workerPool.js";
import { Geometry } from "../geometry.js";
import { VertexBuffer } from "../buffer.js";
import { VertexData } from "../mesh.vertexData.js";
import { Logger } from "../../Misc/logger.js";
import { decodeMesh, workerFunction, initializeWebWorker } from "./dracoCompressionWorker.js";
function createDecoderAsync(wasmBinary, jsModule) {
    return new Promise((resolve) => {
        (jsModule || DracoDecoderModule)({ wasmBinary }).then((module) => {
            resolve({ module });
        });
    });
}
/**
 * Draco compression (https://google.github.io/draco/)
 *
 * This class wraps the Draco module.
 *
 * **Encoder**
 *
 * The encoder is not currently implemented.
 *
 * **Decoder**
 *
 * By default, the configuration points to a copy of the Draco decoder files for glTF from the babylon.js preview cdn https://preview.babylonjs.com/draco_wasm_wrapper_gltf.js.
 *
 * To update the configuration, use the following code:
 * ```javascript
 *     DracoCompression.Configuration = {
 *         decoder: {
 *             wasmUrl: "<url to the WebAssembly library>",
 *             wasmBinaryUrl: "<url to the WebAssembly binary>",
 *             fallbackUrl: "<url to the fallback JavaScript library>",
 *         }
 *     };
 * ```
 *
 * Draco has two versions, one for WebAssembly and one for JavaScript. The decoder configuration can be set to only support WebAssembly or only support the JavaScript version.
 * Decoding will automatically fallback to the JavaScript version if WebAssembly version is not configured or if WebAssembly is not supported by the browser.
 * Use `DracoCompression.DecoderAvailable` to determine if the decoder configuration is available for the current context.
 *
 * To decode Draco compressed data, get the default DracoCompression object and call decodeMeshToGeometryAsync:
 * ```javascript
 *     var geometry = await DracoCompression.Default.decodeMeshToGeometryAsync(data);
 * ```
 *
 * @see https://playground.babylonjs.com/#DMZIBD#0
 */
export class DracoCompression {
    /**
     * Returns true if the decoder configuration is available.
     */
    static get DecoderAvailable() {
        const decoder = DracoCompression.Configuration.decoder;
        return !!((decoder.wasmUrl && decoder.wasmBinaryUrl && typeof WebAssembly === "object") || decoder.fallbackUrl);
    }
    static GetDefaultNumWorkers() {
        if (typeof navigator !== "object" || !navigator.hardwareConcurrency) {
            return 1;
        }
        // Use 50% of the available logical processors but capped at 4.
        return Math.min(Math.floor(navigator.hardwareConcurrency * 0.5), 4);
    }
    /**
     * Default instance for the draco compression object.
     */
    static get Default() {
        if (!DracoCompression._Default) {
            DracoCompression._Default = new DracoCompression();
        }
        return DracoCompression._Default;
    }
    /**
     * Constructor
     * @param numWorkers The number of workers for async operations Or an options object. Specify `0` to disable web workers and run synchronously in the current context.
     */
    constructor(numWorkers = DracoCompression.DefaultNumWorkers) {
        const decoder = DracoCompression.Configuration.decoder;
        // check if the decoder binary and worker pool was injected
        // Note - it is expected that the developer checked if WebWorker, WebAssembly and the URL object are available
        if (decoder.workerPool || (typeof numWorkers === "object" && numWorkers.workerPool)) {
            // set the promise accordingly
            this._workerPoolPromise = Promise.resolve(decoder.workerPool || numWorkers.workerPool);
        }
        else {
            // to avoid making big changes to the decider, if wasmBinary is provided use it in the wasmBinaryPromise
            const wasmBinaryProvided = decoder.wasmBinary || (typeof numWorkers === "object" && numWorkers.wasmBinary);
            const numberOfWorkers = typeof numWorkers === "number" ? numWorkers : numWorkers.numWorkers;
            const useWorkers = numberOfWorkers && typeof Worker === "function" && typeof URL === "function";
            const urlNeeded = useWorkers || (!useWorkers && !decoder.jsModule);
            // code maintained here for back-compat with no changes
            const decoderInfo = decoder.wasmUrl && decoder.wasmBinaryUrl && typeof WebAssembly === "object"
                ? {
                    url: urlNeeded ? Tools.GetBabylonScriptURL(decoder.wasmUrl, true) : "",
                    wasmBinaryPromise: wasmBinaryProvided ? Promise.resolve(wasmBinaryProvided) : Tools.LoadFileAsync(Tools.GetBabylonScriptURL(decoder.wasmBinaryUrl, true)),
                }
                : {
                    url: urlNeeded ? Tools.GetBabylonScriptURL(decoder.fallbackUrl) : "",
                    wasmBinaryPromise: Promise.resolve(undefined),
                };
            if (useWorkers) {
                this._workerPoolPromise = decoderInfo.wasmBinaryPromise.then((decoderWasmBinary) => {
                    const workerContent = `${decodeMesh}(${workerFunction})()`;
                    const workerBlobUrl = URL.createObjectURL(new Blob([workerContent], { type: "application/javascript" }));
                    return new AutoReleaseWorkerPool(numberOfWorkers, () => {
                        const worker = new Worker(workerBlobUrl);
                        return initializeWebWorker(worker, decoderWasmBinary, decoderInfo.url);
                    });
                });
            }
            else {
                this._decoderModulePromise = decoderInfo.wasmBinaryPromise.then(async (decoderWasmBinary) => {
                    if (typeof DracoDecoderModule === "undefined") {
                        if (!decoder.jsModule) {
                            if (!decoderInfo.url) {
                                throw new Error("Draco decoder module is not available");
                            }
                            await Tools.LoadBabylonScriptAsync(decoderInfo.url);
                        }
                    }
                    return await createDecoderAsync(decoderWasmBinary, decoder.jsModule);
                });
            }
        }
    }
    /**
     * Stop all async operations and release resources.
     */
    dispose() {
        if (this._workerPoolPromise) {
            this._workerPoolPromise.then((workerPool) => {
                workerPool.dispose();
            });
        }
        delete this._workerPoolPromise;
        delete this._decoderModulePromise;
    }
    /**
     * Returns a promise that resolves when ready. Call this manually to ensure draco compression is ready before use.
     * @returns a promise that resolves when ready
     */
    async whenReadyAsync() {
        if (this._workerPoolPromise) {
            await this._workerPoolPromise;
            return;
        }
        if (this._decoderModulePromise) {
            await this._decoderModulePromise;
            return;
        }
    }
    _decodeMeshAsync(data, attributes, gltfNormalizedOverride) {
        const dataView = data instanceof ArrayBuffer ? new Int8Array(data) : new Int8Array(data.buffer, data.byteOffset, data.byteLength);
        const applyGltfNormalizedOverride = (kind, normalized) => {
            if (gltfNormalizedOverride && gltfNormalizedOverride[kind] !== undefined) {
                if (normalized !== gltfNormalizedOverride[kind]) {
                    Logger.Warn(`Normalized flag from Draco data (${normalized}) does not match normalized flag from glTF accessor (${gltfNormalizedOverride[kind]}). Using flag from glTF accessor.`);
                }
                return gltfNormalizedOverride[kind];
            }
            else {
                return normalized;
            }
        };
        if (this._workerPoolPromise) {
            return this._workerPoolPromise.then((workerPool) => {
                return new Promise((resolve, reject) => {
                    workerPool.push((worker, onComplete) => {
                        let resultIndices = null;
                        const resultAttributes = [];
                        const onError = (error) => {
                            worker.removeEventListener("error", onError);
                            worker.removeEventListener("message", onMessage);
                            reject(error);
                            onComplete();
                        };
                        const onMessage = (event) => {
                            const message = event.data;
                            switch (message.id) {
                                case "decodeMeshDone": {
                                    worker.removeEventListener("error", onError);
                                    worker.removeEventListener("message", onMessage);
                                    resolve({ indices: resultIndices, attributes: resultAttributes, totalVertices: message.totalVertices });
                                    onComplete();
                                    break;
                                }
                                case "indices": {
                                    resultIndices = message.data;
                                    break;
                                }
                                case "attribute": {
                                    resultAttributes.push({
                                        kind: message.kind,
                                        data: message.data,
                                        size: message.size,
                                        byteOffset: message.byteOffset,
                                        byteStride: message.byteStride,
                                        normalized: applyGltfNormalizedOverride(message.kind, message.normalized),
                                    });
                                    break;
                                }
                            }
                        };
                        worker.addEventListener("error", onError);
                        worker.addEventListener("message", onMessage);
                        const dataViewCopy = dataView.slice();
                        worker.postMessage({ id: "decodeMesh", dataView: dataViewCopy, attributes: attributes }, [dataViewCopy.buffer]);
                    });
                });
            });
        }
        if (this._decoderModulePromise) {
            return this._decoderModulePromise.then((decoder) => {
                let resultIndices = null;
                const resultAttributes = [];
                const numPoints = decodeMesh(decoder.module, dataView, attributes, (indices) => {
                    resultIndices = indices;
                }, (kind, data, size, byteOffset, byteStride, normalized) => {
                    resultAttributes.push({
                        kind,
                        data,
                        size,
                        byteOffset,
                        byteStride,
                        normalized,
                    });
                });
                return { indices: resultIndices, attributes: resultAttributes, totalVertices: numPoints };
            });
        }
        throw new Error("Draco decoder module is not available");
    }
    /**
     * Decode Draco compressed mesh data to Babylon geometry.
     * @param name The name to use when creating the geometry
     * @param scene The scene to use when creating the geometry
     * @param data The ArrayBuffer or ArrayBufferView for the Draco compression data
     * @param attributes A map of attributes from vertex buffer kinds to Draco unique ids
     * @returns A promise that resolves with the decoded geometry
     */
    async decodeMeshToGeometryAsync(name, scene, data, attributes) {
        const meshData = await this._decodeMeshAsync(data, attributes);
        const geometry = new Geometry(name, scene);
        if (meshData.indices) {
            geometry.setIndices(meshData.indices);
        }
        for (const attribute of meshData.attributes) {
            geometry.setVerticesBuffer(new VertexBuffer(scene.getEngine(), attribute.data, attribute.kind, false, undefined, attribute.byteStride, undefined, attribute.byteOffset, attribute.size, undefined, attribute.normalized, true), meshData.totalVertices);
        }
        return geometry;
    }
    /** @internal */
    async _decodeMeshToGeometryForGltfAsync(name, scene, data, attributes, gltfNormalizedOverride) {
        const meshData = await this._decodeMeshAsync(data, attributes, gltfNormalizedOverride);
        const geometry = new Geometry(name, scene);
        if (meshData.indices) {
            geometry.setIndices(meshData.indices);
        }
        for (const attribute of meshData.attributes) {
            geometry.setVerticesBuffer(new VertexBuffer(scene.getEngine(), attribute.data, attribute.kind, false, undefined, attribute.byteStride, undefined, attribute.byteOffset, attribute.size, undefined, attribute.normalized, true), meshData.totalVertices);
        }
        return geometry;
    }
    /**
     * Decode Draco compressed mesh data to Babylon vertex data.
     * @param data The ArrayBuffer or ArrayBufferView for the Draco compression data
     * @param attributes A map of attributes from vertex buffer kinds to Draco unique ids
     * @returns A promise that resolves with the decoded vertex data
     * @deprecated Use {@link decodeMeshToGeometryAsync} for better performance in some cases
     */
    async decodeMeshAsync(data, attributes) {
        const meshData = await this._decodeMeshAsync(data, attributes);
        const vertexData = new VertexData();
        if (meshData.indices) {
            vertexData.indices = meshData.indices;
        }
        for (const attribute of meshData.attributes) {
            const floatData = VertexBuffer.GetFloatData(attribute.data, attribute.size, VertexBuffer.GetDataType(attribute.data), attribute.byteOffset, attribute.byteStride, attribute.normalized, meshData.totalVertices);
            vertexData.set(floatData, attribute.kind);
        }
        return vertexData;
    }
}
/**
 * The configuration. Defaults to the following urls:
 * - wasmUrl: "https://cdn.babylonjs.com/draco_wasm_wrapper_gltf.js"
 * - wasmBinaryUrl: "https://cdn.babylonjs.com/draco_decoder_gltf.wasm"
 * - fallbackUrl: "https://cdn.babylonjs.com/draco_decoder_gltf.js"
 */
DracoCompression.Configuration = {
    decoder: {
        wasmUrl: `${Tools._DefaultCdnUrl}/draco_wasm_wrapper_gltf.js`,
        wasmBinaryUrl: `${Tools._DefaultCdnUrl}/draco_decoder_gltf.wasm`,
        fallbackUrl: `${Tools._DefaultCdnUrl}/draco_decoder_gltf.js`,
    },
};
/**
 * Default number of workers to create when creating the draco compression object.
 */
DracoCompression.DefaultNumWorkers = DracoCompression.GetDefaultNumWorkers();
DracoCompression._Default = null;
//# sourceMappingURL=dracoCompression.js.map