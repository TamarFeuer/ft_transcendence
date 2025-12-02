import { NodeGeometryBlock } from "../nodeGeometryBlock";
import type { NodeGeometryConnectionPoint } from "../nodeGeometryBlockConnectionPoint";
/**
 * Block used to desaturate a color
 */
export declare class GeometryDesaturateBlock extends NodeGeometryBlock {
    /**
     * Creates a new GeometryDesaturateBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets the color operand input component
     */
    get color(): NodeGeometryConnectionPoint;
    /**
     * Gets the level operand input component
     */
    get level(): NodeGeometryConnectionPoint;
    /**
     * Gets the output component
     */
    get output(): NodeGeometryConnectionPoint;
    protected _buildBlock(): this | undefined;
}
