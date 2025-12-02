import { FlowGraphEventBlock } from "../../flowGraphEventBlock";
import type { FlowGraphContext } from "../../flowGraphContext.js";
/**
 * @experimental
 * Block that triggers on scene tick (before each render).
 */
export declare class FlowGraphSceneTickEventBlock extends FlowGraphEventBlock {
    /**
     * @internal
     */
    _preparePendingTasks(context: FlowGraphContext): void;
    /**
     * @internal
     */
    _cancelPendingTasks(context: FlowGraphContext): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
    /**
     * the class name of the block.
     */
    static ClassName: string;
}
