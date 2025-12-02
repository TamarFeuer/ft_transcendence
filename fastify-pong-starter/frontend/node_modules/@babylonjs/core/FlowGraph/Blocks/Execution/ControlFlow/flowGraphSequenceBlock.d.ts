import type { IFlowGraphBlockConfiguration } from "../../../flowGraphBlock";
import type { FlowGraphContext } from "../../../flowGraphContext";
import { FlowGraphExecutionBlock } from "../../../flowGraphExecutionBlock";
import type { FlowGraphSignalConnection } from "../../../flowGraphSignalConnection";
/**
 * @experimental
 * Configuration for the sequence block.
 */
export interface IFlowGraphSequenceBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The number of output flows.
     */
    numberOutputFlows: number;
}
/**
 * @experimental
 * A block that executes its output flows in sequence.
 */
export declare class FlowGraphSequenceBlock extends FlowGraphExecutionBlock {
    /**
     * the configuration of the block
     */
    config: IFlowGraphSequenceBlockConfiguration;
    /**
     * The output flows.
     */
    outFlows: FlowGraphSignalConnection[];
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphSequenceBlockConfiguration);
    _execute(context: FlowGraphContext): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
    /**
     * the class name of the block.
     */
    static ClassName: string;
}
