
import { WebGPUEngine } from "../../webgpuEngine.js";
import * as WebGPUConstants from "../webgpuConstants.js";
import { Effect } from "../../../Materials/effect.js";
Effect.prototype.setStorageBuffer = function (name, buffer) {
    this._engine.setStorageBuffer(name, buffer);
};
WebGPUEngine.prototype.createStorageBuffer = function (data, creationFlags, label) {
    return this._createBuffer(data, creationFlags | 32, label);
};
WebGPUEngine.prototype.updateStorageBuffer = function (buffer, data, byteOffset, byteLength) {
    const dataBuffer = buffer;
    if (byteOffset === undefined) {
        byteOffset = 0;
    }
    let view;
    if (byteLength === undefined) {
        if (data instanceof Array) {
            view = new Float32Array(data);
        }
        else if (data instanceof ArrayBuffer) {
            view = new Uint8Array(data);
        }
        else {
            view = data;
        }
        byteLength = view.byteLength;
    }
    else {
        if (data instanceof Array) {
            view = new Float32Array(data);
        }
        else if (data instanceof ArrayBuffer) {
            view = new Uint8Array(data);
        }
        else {
            view = data;
        }
    }
    this._bufferManager.setSubData(dataBuffer, byteOffset, view, 0, byteLength);
};
WebGPUEngine.prototype.readFromStorageBuffer = function (storageBuffer, offset, size, buffer, noDelay) {
    size = size || storageBuffer.capacity;
    const gpuBuffer = this._bufferManager.createRawBuffer(size, WebGPUConstants.BufferUsage.MapRead | WebGPUConstants.BufferUsage.CopyDst, undefined, "TempReadFromStorageBuffer");
    this._renderEncoder.copyBufferToBuffer(storageBuffer.underlyingResource, offset ?? 0, gpuBuffer, 0, size);
    return new Promise((resolve, reject) => {
        const readFromBuffer = () => {
            gpuBuffer.mapAsync(WebGPUConstants.MapMode.Read, 0, size).then(() => {
                const copyArrayBuffer = gpuBuffer.getMappedRange(0, size);
                let data = buffer;
                if (data === undefined) {
                    data = new Uint8Array(size);
                    data.set(new Uint8Array(copyArrayBuffer));
                }
                else {
                    const ctor = data.constructor; // we want to create result data with the same type as buffer (Uint8Array, Float32Array, ...)
                    data = new ctor(data.buffer);
                    data.set(new ctor(copyArrayBuffer));
                }
                gpuBuffer.unmap();
                this._bufferManager.releaseBuffer(gpuBuffer);
                resolve(data);
            }, (reason) => {
                if (this.isDisposed) {
                    resolve(new Uint8Array());
                }
                else {
                    reject(reason);
                }
            });
        };
        if (noDelay) {
            this.flushFramebuffer();
            readFromBuffer();
        }
        else {
            // we are using onEndFrameObservable because we need to map the gpuBuffer AFTER the command buffers
            // have been submitted, else we get the error: "Buffer used in a submit while mapped"
            this.onEndFrameObservable.addOnce(() => {
                readFromBuffer();
            });
        }
    });
};
WebGPUEngine.prototype.setStorageBuffer = function (name, buffer) {
    this._currentDrawContext?.setBuffer(name, buffer?.getBuffer() ?? null);
};
//# sourceMappingURL=engine.storageBuffer.js.map