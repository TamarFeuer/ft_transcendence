import { FlowGraphBlock } from "../../flowGraphBlock.js";
import type { FlowGraphContext } from "../../flowGraphContext.js";
import type { FlowGraphDataConnection } from "../../flowGraphDataConnection.js";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
/**
 * @experimental
 * Configuration for a constant block.
 */
export interface IFlowGraphConstantBlockConfiguration<T> extends IFlowGraphBlockConfiguration {
    /**
     * The value of the constant.
     */
    value: T;
}
/**
 * @experimental
 * Block that returns a constant value.
 */
export declare class FlowGraphConstantBlock<T> extends FlowGraphBlock {
    /**
     * the configuration of the block
     */
    config: IFlowGraphConstantBlockConfiguration<T>;
    /**
     * Output connection: The constant value.
     */
    readonly output: FlowGraphDataConnection<T>;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphConstantBlockConfiguration<T>);
    _updateOutputs(context: FlowGraphContext): void;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Serializes this block
     * @param serializationObject the object to serialize to
     * @param valueSerializeFunction the function to use to serialize the value
     */
    serialize(serializationObject?: any, valueSerializeFunction?: (key: string, value: any, serializationObject: any) => any): void;
}
