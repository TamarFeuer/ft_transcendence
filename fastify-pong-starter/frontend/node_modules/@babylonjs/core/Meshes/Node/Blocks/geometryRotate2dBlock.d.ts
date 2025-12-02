import { NodeGeometryBlock } from "../nodeGeometryBlock";
import type { NodeGeometryConnectionPoint } from "../nodeGeometryBlockConnectionPoint";
/**
 * Block used to rotate a 2d vector by a given angle
 */
export declare class GeometryRotate2dBlock extends NodeGeometryBlock {
    /**
     * Creates a new GeometryRotate2dBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets the input vector
     */
    get input(): NodeGeometryConnectionPoint;
    /**
     * Gets the input angle
     */
    get angle(): NodeGeometryConnectionPoint;
    /**
     * Gets the output component
     */
    get output(): NodeGeometryConnectionPoint;
    protected _buildBlock(): this | undefined;
}
