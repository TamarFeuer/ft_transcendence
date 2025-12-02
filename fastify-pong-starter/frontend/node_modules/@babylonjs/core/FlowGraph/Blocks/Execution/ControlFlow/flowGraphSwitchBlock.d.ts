import type { FlowGraphContext } from "../../../flowGraphContext";
import type { FlowGraphDataConnection } from "../../../flowGraphDataConnection";
import { FlowGraphExecutionBlock } from "../../../flowGraphExecutionBlock";
import type { FlowGraphSignalConnection } from "../../../flowGraphSignalConnection";
import type { IFlowGraphBlockConfiguration } from "../../../flowGraphBlock";
/**
 * @experimental
 * Configuration for a switch block.
 */
export interface IFlowGraphSwitchBlockConfiguration<T> extends IFlowGraphBlockConfiguration {
    /**
     * The possible values for the selection.
     */
    cases: T[];
}
/**
 * @experimental
 * A block that executes a branch based on a selection.
 */
export declare class FlowGraphSwitchBlock<T> extends FlowGraphExecutionBlock {
    /**
     * the configuration of the block
     */
    config: IFlowGraphSwitchBlockConfiguration<T>;
    /**
     * Input connection: The value of the selection.
     */
    readonly selection: FlowGraphDataConnection<T>;
    /**
     * Output connection: The output flows.
     */
    outputFlows: FlowGraphSignalConnection[];
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphSwitchBlockConfiguration<T>);
    _execute(context: FlowGraphContext, _callingSignal: FlowGraphSignalConnection): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
    /**
     * Serialize the block to a JSON representation.
     * @param serializationObject the object to serialize to.
     */
    serialize(serializationObject?: any): void;
}
