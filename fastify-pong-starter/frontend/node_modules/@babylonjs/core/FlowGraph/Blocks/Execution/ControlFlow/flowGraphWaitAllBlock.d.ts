import type { FlowGraphContext } from "../../../flowGraphContext";
import type { FlowGraphSignalConnection } from "../../../flowGraphSignalConnection";
import { FlowGraphExecutionBlockWithOutSignal } from "../../../flowGraphExecutionBlockWithOutSignal";
import type { IFlowGraphBlockConfiguration } from "../../../flowGraphBlock";
/**
 * @experimental
 * Configuration for the wait all block.
 */
export interface IFlowGraphWaitAllBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The number of input flows. There will always be at least one input flow.
     */
    numberInputFlows: number;
}
/**
 * @experimental
 * A block that waits for all input flows to be activated before activating its output flow.
 */
export declare class FlowGraphWaitAllBlock extends FlowGraphExecutionBlockWithOutSignal {
    /**
     * the configuration of the block
     */
    config: IFlowGraphWaitAllBlockConfiguration;
    /**
     * Input connection: Resets the block.
     */
    reset: FlowGraphSignalConnection;
    /**
     * Input connection: The 2nd to nth input flows (the first is named onStart)
     */
    readonly inFlows: FlowGraphSignalConnection[];
    private _cachedActivationState;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphWaitAllBlockConfiguration);
    private _getCurrentActivationState;
    _execute(context: FlowGraphContext, callingSignal: FlowGraphSignalConnection): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
    /**
     * Serializes this block into a object
     * @param serializationObject the object to serialize to
     */
    serialize(serializationObject?: any): void;
}
