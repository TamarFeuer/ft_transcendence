import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
import type { RichType } from "../../flowGraphRichTypes";
import type { FlowGraphContext } from "../../flowGraphContext";
import { FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock";
/**
 * @experimental
 * The base block for all unary operation blocks. Receives an input of type InputT, and outputs a value of type ResultT.
 */
export declare class FlowGraphUnaryOperationBlock<InputT, ResultT> extends FlowGraphCachedOperationBlock<ResultT> {
    private _operation;
    private _className;
    /**
     * the input of this block
     */
    a: FlowGraphDataConnection<InputT>;
    constructor(inputRichType: RichType<InputT>, resultRichType: RichType<ResultT>, _operation: (input: InputT) => ResultT, _className: string, config?: IFlowGraphBlockConfiguration);
    /**
     * the operation performed by this block
     * @param context the graph context
     * @returns the result of the operation
     */
    _doOperation(context: FlowGraphContext): ResultT;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
}
