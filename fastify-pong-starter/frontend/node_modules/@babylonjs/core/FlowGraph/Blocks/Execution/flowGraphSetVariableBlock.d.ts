import type { FlowGraphContext } from "../../flowGraphContext";
import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
import { FlowGraphExecutionBlockWithOutSignal } from "../../flowGraphExecutionBlockWithOutSignal";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
/**
 * @experimental
 * The variable block configuration.
 */
export interface IFlowGraphSetVariableBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The name of the variable to set.
     */
    variableName: string;
}
/**
 * Block to set a variable.
 * @experimental
 */
export declare class FlowGraphSetVariableBlock<T> extends FlowGraphExecutionBlockWithOutSignal {
    /**
     * the configuration of the block
     */
    config: IFlowGraphSetVariableBlockConfiguration;
    /**
     * Input connection: The value to set on the variable.
     */
    readonly input: FlowGraphDataConnection<T>;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphSetVariableBlockConfiguration);
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
