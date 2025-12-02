import type { Nullable } from "../types";
export declare function expandToProperty(callback: string, targetKey?: Nullable<string>): (target: any, propertyKey: string) => void;
export declare function serialize(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsTexture(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsColor3(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsFresnelParameters(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsVector2(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsVector3(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsMeshReference(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsColorCurves(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsColor4(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsImageProcessingConfiguration(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsQuaternion(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
export declare function serializeAsMatrix(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
/**
 * Decorator used to define property that can be serialized as reference to a camera
 * @param sourceName defines the name of the property to decorate
 * @returns Property Decorator
 */
export declare function serializeAsCameraReference(sourceName?: string): (target: any, propertyKey: string | symbol) => void;
/**
 * Decorator used to redirect a function to a native implementation if available.
 * @internal
 */
export declare function nativeOverride<T extends (...params: any[]) => boolean>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: Parameters<T>) => unknown>, predicate?: T): void;
export declare namespace nativeOverride {
    var filter: <T extends (...params: any) => boolean>(predicate: T) => (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<(...params: Parameters<T>) => unknown>) => void;
}
