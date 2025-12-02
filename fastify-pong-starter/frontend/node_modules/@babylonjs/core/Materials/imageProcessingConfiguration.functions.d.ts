import type { IImageProcessingConfigurationDefines } from "./imageProcessingConfiguration.defines";
/**
 * Prepare the list of uniforms associated with the Image Processing effects.
 * @param uniforms The list of uniforms used in the effect
 * @param defines the list of defines currently in use
 */
export declare function PrepareUniformsForImageProcessing(uniforms: string[], defines: IImageProcessingConfigurationDefines): void;
/**
 * Prepare the list of samplers associated with the Image Processing effects.
 * @param samplersList The list of uniforms used in the effect
 * @param defines the list of defines currently in use
 */
export declare function PrepareSamplersForImageProcessing(samplersList: string[], defines: IImageProcessingConfigurationDefines): void;
