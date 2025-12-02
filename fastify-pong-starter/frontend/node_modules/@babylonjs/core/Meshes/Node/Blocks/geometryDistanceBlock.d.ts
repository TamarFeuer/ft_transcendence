import { NodeGeometryBlock } from "../nodeGeometryBlock";
import type { NodeGeometryConnectionPoint } from "../nodeGeometryBlockConnectionPoint";
/**
 * Block used to get the distance between 2 values
 */
export declare class GeometryDistanceBlock extends NodeGeometryBlock {
    /**
     * Creates a new GeometryDistanceBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets the left operand input component
     */
    get left(): NodeGeometryConnectionPoint;
    /**
     * Gets the right operand input component
     */
    get right(): NodeGeometryConnectionPoint;
    /**
     * Gets the output component
     */
    get output(): NodeGeometryConnectionPoint;
    protected _buildBlock(): this | undefined;
}
