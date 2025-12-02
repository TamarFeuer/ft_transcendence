import type { FlowGraphContext } from "../../flowGraphContext";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
import { FlowGraphBlock } from "../../flowGraphBlock";
import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
/**
 * @experimental
 * The configuration of the FlowGraphGetVariableBlock.
 */
export interface IFlowGraphGetVariableBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The name of the variable to get.
     */
    variableName: string;
}
/**
 * A block that gets the value of a variable.
 * @experimental
 */
export declare class FlowGraphGetVariableBlock<T> extends FlowGraphBlock {
    config: IFlowGraphGetVariableBlockConfiguration;
    /**
     * Output connection: The value of the variable.
     */
    readonly output: FlowGraphDataConnection<T>;
    /**
     * Construct a FlowGraphGetVariableBlock.
     * @param config construction parameters
     */
    constructor(config: IFlowGraphGetVariableBlockConfiguration);
    /**
     * @internal
     */
    _updateOutputs(context: FlowGraphContext): void;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Serializes this block
     * @param serializationObject the object to serialize to
     */
    serialize(serializationObject?: any): void;
    /**
     * Class name of the block.
     */
    static ClassName: string;
}
