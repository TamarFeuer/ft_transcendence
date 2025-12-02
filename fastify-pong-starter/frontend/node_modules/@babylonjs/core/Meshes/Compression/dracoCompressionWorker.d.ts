export interface AttributeData {
    kind: string;
    data: ArrayBufferView;
    size: number;
    byteOffset: number;
    byteStride: number;
    normalized: boolean;
}
interface InitDoneMessage {
    id: "initDone";
}
interface DecodeMeshDoneMessage {
    id: "decodeMeshDone";
    totalVertices: number;
}
interface IndicesMessage {
    id: "indices";
    data: Uint16Array | Uint32Array;
}
interface AttributeMessage extends AttributeData {
    id: "attribute";
}
export type Message = InitDoneMessage | DecodeMeshDoneMessage | IndicesMessage | AttributeMessage;
/**
 * @internal
 */
export declare function decodeMesh(decoderModule: any, data: Int8Array, attributes: {
    [kind: string]: number;
} | undefined, onIndicesData: (indices: Uint16Array | Uint32Array) => void, onAttributeData: (kind: string, data: ArrayBufferView, size: number, offset: number, stride: number, normalized: boolean) => void): number;
/**
 * The worker function that gets converted to a blob url to pass into a worker.
 * To be used if a developer wants to create their own worker instance and inject it instead of using the default worker.
 */
export declare function workerFunction(): void;
/**
 * Initializes a worker that was created for the draco agent pool
 * @param worker  The worker to initialize
 * @param decoderWasmBinary The wasm binary to load into the worker
 * @param moduleUrl The url to the draco decoder module (optional)
 * @returns A promise that resolves when the worker is initialized
 */
export declare function initializeWebWorker(worker: Worker, decoderWasmBinary: ArrayBuffer, moduleUrl?: string): Promise<Worker>;
export {};
