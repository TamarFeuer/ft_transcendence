import type { FresnelParameters } from "../Materials/fresnelParameters";
import type { ImageProcessingConfiguration } from "../Materials/imageProcessingConfiguration";
import type { ColorCurves } from "../Materials/colorCurves";
import type { Scene } from "../scene";
import type { Nullable } from "../types";
import type { BaseTexture } from "../Materials/Textures/baseTexture";
import type { IAnimatable } from "../Animations/animatable.interface";
/** @internal */
export interface CopySourceOptions {
    cloneTexturesOnlyOnce?: boolean;
}
/**
 * Class used to help serialization objects
 */
export declare class SerializationHelper {
    /**
     * Gets or sets a boolean to indicate if the UniqueId property should be serialized
     */
    static AllowLoadingUniqueId: boolean;
    /**
     * @internal
     */
    static _ImageProcessingConfigurationParser: (sourceProperty: any) => ImageProcessingConfiguration;
    /**
     * @internal
     */
    static _FresnelParametersParser: (sourceProperty: any) => FresnelParameters;
    /**
     * @internal
     */
    static _ColorCurvesParser: (sourceProperty: any) => ColorCurves;
    /**
     * @internal
     */
    static _TextureParser: (sourceProperty: any, scene: Scene, rootUrl: string) => Nullable<BaseTexture>;
    /**
     * Appends the serialized animations from the source animations
     * @param source Source containing the animations
     * @param destination Target to store the animations
     */
    static AppendSerializedAnimations(source: IAnimatable, destination: any): void;
    /**
     * Static function used to serialized a specific entity
     * @param entity defines the entity to serialize
     * @param serializationObject defines the optional target object where serialization data will be stored
     * @returns a JSON compatible object representing the serialization of the entity
     */
    static Serialize<T>(entity: T, serializationObject?: any): any;
    /**
     * Given a source json and a destination object in a scene, this function will parse the source and will try to apply its content to the destination object
     * @param source the source json data
     * @param destination the destination object
     * @param scene the scene where the object is
     * @param rootUrl root url to use to load assets
     */
    static ParseProperties(source: any, destination: any, scene: Nullable<Scene>, rootUrl: Nullable<string>): void;
    /**
     * Creates a new entity from a serialization data object
     * @param creationFunction defines a function used to instanciated the new entity
     * @param source defines the source serialization data
     * @param scene defines the hosting scene
     * @param rootUrl defines the root url for resources
     * @returns a new entity
     */
    static Parse<T>(creationFunction: () => T, source: any, scene: Nullable<Scene>, rootUrl?: Nullable<string>): T;
    /**
     * Clones an object
     * @param creationFunction defines the function used to instanciate the new object
     * @param source defines the source object
     * @param options defines the options to use
     * @returns the cloned object
     */
    static Clone<T>(creationFunction: () => T, source: T, options?: CopySourceOptions): T;
    /**
     * Instanciates a new object based on a source one (some data will be shared between both object)
     * @param creationFunction defines the function used to instanciate the new object
     * @param source defines the source object
     * @returns the new object
     */
    static Instanciate<T>(creationFunction: () => T, source: T): T;
}
