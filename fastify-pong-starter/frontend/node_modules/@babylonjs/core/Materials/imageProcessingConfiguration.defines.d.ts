import { MaterialDefines } from "./materialDefines";
/**
 * Interface to follow in your material defines to integrate easily the
 * Image processing functions.
 * @internal
 */
export interface IImageProcessingConfigurationDefines {
    IMAGEPROCESSING: boolean;
    VIGNETTE: boolean;
    VIGNETTEBLENDMODEMULTIPLY: boolean;
    VIGNETTEBLENDMODEOPAQUE: boolean;
    TONEMAPPING: boolean;
    TONEMAPPING_ACES: boolean;
    CONTRAST: boolean;
    EXPOSURE: boolean;
    COLORCURVES: boolean;
    COLORGRADING: boolean;
    COLORGRADING3D: boolean;
    SAMPLER3DGREENDEPTH: boolean;
    SAMPLER3DBGRMAP: boolean;
    DITHER: boolean;
    IMAGEPROCESSINGPOSTPROCESS: boolean;
    SKIPFINALCOLORCLAMP: boolean;
}
/**
 * @internal
 */
export declare class ImageProcessingConfigurationDefines extends MaterialDefines implements IImageProcessingConfigurationDefines {
    IMAGEPROCESSING: boolean;
    VIGNETTE: boolean;
    VIGNETTEBLENDMODEMULTIPLY: boolean;
    VIGNETTEBLENDMODEOPAQUE: boolean;
    TONEMAPPING: boolean;
    TONEMAPPING_ACES: boolean;
    CONTRAST: boolean;
    COLORCURVES: boolean;
    COLORGRADING: boolean;
    COLORGRADING3D: boolean;
    SAMPLER3DGREENDEPTH: boolean;
    SAMPLER3DBGRMAP: boolean;
    DITHER: boolean;
    IMAGEPROCESSINGPOSTPROCESS: boolean;
    EXPOSURE: boolean;
    SKIPFINALCOLORCLAMP: boolean;
    constructor();
}
