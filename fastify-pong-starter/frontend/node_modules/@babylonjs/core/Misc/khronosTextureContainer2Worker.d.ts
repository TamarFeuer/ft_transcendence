export type AllowedKeys = "wasmUASTCToASTC" | "wasmUASTCToBC7" | "wasmUASTCToRGBA_UNORM" | "wasmUASTCToRGBA_SRGB" | "wasmUASTCToR8_UNORM" | "wasmUASTCToRG8_UNORM" | "wasmMSCTranscoder" | "wasmZSTDDecoder" | "jsDecoderModule" | "jsMSCTranscoder";
export declare function applyConfig(urls?: {
    [key in AllowedKeys]: string;
}, binariesAndModulesContainer?: {
    [key in AllowedKeys]: ArrayBuffer | any;
}): void;
export declare function workerFunction(KTX2DecoderModule: any): void;
export declare function initializeWebWorker(worker: Worker, wasmBinaries?: {
    [key in AllowedKeys]?: ArrayBuffer;
}, urls?: {
    [key in AllowedKeys]: string;
}): Promise<Worker>;
