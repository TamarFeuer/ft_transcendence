import { FlowGraphBlock } from "../../flowGraphBlock";
import type { FlowGraphContext } from "../../flowGraphContext";
import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
import { Vector3 } from "../../../Maths/math.vector";
import type { TransformNode } from "../../../Meshes/transformNode";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
/**
 * @experimental
 * This blocks transforms a vector from one coordinate system to another.
 */
export declare class FlowGraphCoordinateTransformBlock extends FlowGraphBlock {
    /**
     * Input connection: The source coordinate system.
     */
    readonly sourceSystem: FlowGraphDataConnection<TransformNode>;
    /**
     * Input connection: The destination coordinate system.
     */
    readonly destinationSystem: FlowGraphDataConnection<TransformNode>;
    /**
     * Input connection: The coordinates to transform.
     */
    readonly inputCoordinates: FlowGraphDataConnection<Vector3>;
    /**
     * Output connection: The transformed coordinates.
     */
    readonly outputCoordinates: FlowGraphDataConnection<Vector3>;
    /**
     * Creates a new FlowGraphCoordinateTransformBlock
     * @param config optional configuration for this block
     */
    constructor(config?: IFlowGraphBlockConfiguration);
    _updateOutputs(_context: FlowGraphContext): void;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
}
