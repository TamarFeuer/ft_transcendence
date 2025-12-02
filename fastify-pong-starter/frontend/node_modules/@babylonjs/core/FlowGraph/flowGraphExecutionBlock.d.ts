import type { IFlowGraphBlockConfiguration } from "./flowGraphBlock";
import { FlowGraphBlock } from "./flowGraphBlock";
import type { FlowGraphContext } from "./flowGraphContext";
import { FlowGraphSignalConnection } from "./flowGraphSignalConnection";
/**
 * @experimental
 * A block that executes some action. Always has an input signal (which is not used by event blocks).
 * Can have one or more output signals.
 */
export declare abstract class FlowGraphExecutionBlock extends FlowGraphBlock {
    /**
     * Input connection: The input signal of the block.
     */
    readonly in: FlowGraphSignalConnection;
    /**
     * Input connections that activate the block.
     */
    signalInputs: FlowGraphSignalConnection[];
    /**
     * Output connections that can activate downstream blocks.
     */
    signalOutputs: FlowGraphSignalConnection[];
    protected constructor(config?: IFlowGraphBlockConfiguration);
    /**
     * @internal
     * Executes the flow graph execution block.
     */
    abstract _execute(context: FlowGraphContext, callingSignal: FlowGraphSignalConnection): void;
    protected _registerSignalInput(name: string): FlowGraphSignalConnection;
    protected _registerSignalOutput(name: string): FlowGraphSignalConnection;
    /**
     * Given a name of a signal input, return that input if it exists
     * @param name the name of the input
     * @returns if the input exists, the input. Otherwise, undefined.
     */
    getSignalInput(name: string): FlowGraphSignalConnection | undefined;
    /**
     * Given a name of a signal output, return that input if it exists
     * @param name the name of the input
     * @returns if the input exists, the input. Otherwise, undefined.
     */
    getSignalOutput(name: string): FlowGraphSignalConnection | undefined;
    /**
     * Serializes this block
     * @param serializationObject the object to serialize in
     */
    serialize(serializationObject?: any): void;
    /**
     * Deserializes from an object
     * @param serializationObject the object to deserialize from
     */
    deserialize(serializationObject: any): void;
    /**
     * @returns the class name
     */
    getClassName(): string;
}
