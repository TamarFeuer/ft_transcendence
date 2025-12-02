import { FlowGraphExecutionBlockWithOutSignal } from "../../flowGraphExecutionBlockWithOutSignal";
import type { FlowGraphContext } from "../../flowGraphContext";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
/**
 * @experimental
 * Parameters used to create a FlowGraphSendCustomEventBlock.
 */
export interface IFlowGraphSendCustomEventBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The id of the event to send.
     */
    eventId: string;
    /**
     * The names of the data inputs for that event.
     */
    eventData: string[];
}
/**
 * @experimental
 */
export declare class FlowGraphSendCustomEventBlock extends FlowGraphExecutionBlockWithOutSignal {
    /**
     * the configuration of the block
     */
    config: IFlowGraphSendCustomEventBlockConfiguration;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphSendCustomEventBlockConfiguration);
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
