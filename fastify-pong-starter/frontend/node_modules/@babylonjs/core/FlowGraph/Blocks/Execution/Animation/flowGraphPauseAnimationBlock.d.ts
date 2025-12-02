import type { FlowGraphContext } from "../../../flowGraphContext";
import type { FlowGraphDataConnection } from "../../../flowGraphDataConnection";
import { FlowGraphExecutionBlockWithOutSignal } from "../../../flowGraphExecutionBlockWithOutSignal";
import type { Animatable } from "../../../../Animations/animatable";
import type { IFlowGraphBlockConfiguration } from "../../../flowGraphBlock";
/**
 * @experimental
 * Block that pauses a running animation
 */
export declare class FlowGraphPauseAnimationBlock extends FlowGraphExecutionBlockWithOutSignal {
    /**
     * Input connection: The animation to pause.
     */
    readonly animationToPause: FlowGraphDataConnection<Animatable>;
    constructor(config?: IFlowGraphBlockConfiguration);
    _execute(context: FlowGraphContext): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
}
