import type { DeepImmutable, FloatArray } from "../../types";
/** @internal */
export type NativeData = Uint32Array;
/** @internal */
export declare class NativeDataStream {
    private readonly _uint32s;
    private readonly _int32s;
    private readonly _float32s;
    private readonly _length;
    private _position;
    private readonly _nativeDataStream;
    private static readonly DEFAULT_BUFFER_SIZE;
    constructor();
    /**
     * Writes a uint32 to the stream
     * @param value the value to write
     */
    writeUint32(value: number): void;
    /**
     * Writes an int32 to the stream
     * @param value the value to write
     */
    writeInt32(value: number): void;
    /**
     * Writes a float32 to the stream
     * @param value the value to write
     */
    writeFloat32(value: number): void;
    /**
     * Writes a uint32 array to the stream
     * @param values the values to write
     */
    writeUint32Array(values: Uint32Array): void;
    /**
     * Writes an int32 array to the stream
     * @param values the values to write
     */
    writeInt32Array(values: Int32Array): void;
    /**
     * Writes a float32 array to the stream
     * @param values the values to write
     */
    writeFloat32Array(values: DeepImmutable<FloatArray>): void;
    /**
     * Writes native data to the stream
     * @param handle the handle to the native data
     */
    writeNativeData(handle: NativeData): void;
    /**
     * Writes a boolean to the stream
     * @param value the value to write
     */
    writeBoolean(value: boolean): void;
    private _flushIfNecessary;
    private _flush;
}
