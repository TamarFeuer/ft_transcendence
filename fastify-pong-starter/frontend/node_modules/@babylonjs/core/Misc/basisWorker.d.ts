/**
 * The worker function that gets converted to a blob url to pass into a worker.
 * To be used if a developer wants to create their own worker instance and inject it instead of using the default worker.
 */
export declare function workerFunction(): void;
/**
 * Initialize a web worker with the basis transcoder
 * @param worker the worker to initialize
 * @param wasmBinary the wasm binary to load into the worker
 * @param moduleUrl the url to the basis transcoder module
 * @returns a promise that resolves when the worker is initialized
 */
export declare function initializeWebWorker(worker: Worker, wasmBinary: ArrayBuffer, moduleUrl?: string): Promise<Worker>;
