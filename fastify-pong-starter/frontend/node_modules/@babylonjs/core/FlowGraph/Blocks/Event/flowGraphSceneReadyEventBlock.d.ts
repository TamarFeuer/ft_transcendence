import { FlowGraphEventBlock } from "../../flowGraphEventBlock";
import type { FlowGraphContext } from "../../flowGraphContext.js";
/**
 * @experimental
 * Block that triggers when a scene is ready.
 */
export declare class FlowGraphSceneReadyEventBlock extends FlowGraphEventBlock {
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
