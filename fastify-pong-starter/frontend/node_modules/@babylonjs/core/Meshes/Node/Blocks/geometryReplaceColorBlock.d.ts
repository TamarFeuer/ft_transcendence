import { NodeGeometryBlock } from "../nodeGeometryBlock";
import type { NodeGeometryConnectionPoint } from "../nodeGeometryBlockConnectionPoint";
/**
 * Block used to replace a color by another one
 */
export declare class GeometryReplaceColorBlock extends NodeGeometryBlock {
    /**
     * Creates a new GeometryReplaceColorBlock
     * @param name defines the block name
     */
    constructor(name: string);
    /**
     * Gets the current class name
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Gets the value input component
     */
    get value(): NodeGeometryConnectionPoint;
    /**
     * Gets the reference input component
     */
    get reference(): NodeGeometryConnectionPoint;
    /**
     * Gets the distance input component
     */
    get distance(): NodeGeometryConnectionPoint;
    /**
     * Gets the replacement input component
     */
    get replacement(): NodeGeometryConnectionPoint;
    /**
     * Gets the output component
     */
    get output(): NodeGeometryConnectionPoint;
    protected _buildBlock(): this | undefined;
}
