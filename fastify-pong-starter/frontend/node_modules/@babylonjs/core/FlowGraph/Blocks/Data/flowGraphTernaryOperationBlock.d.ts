import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
import type { RichType } from "../../flowGraphRichTypes";
import type { FlowGraphContext } from "../../flowGraphContext";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
import { FlowGraphCachedOperationBlock } from "./flowGraphCachedOperationBlock";
/**
 * @experimental
 * The base block for all ternary operation blocks.
 */
export declare class FlowGraphTernaryOperationBlock<T1, T2, T3, ResultT> extends FlowGraphCachedOperationBlock<ResultT> {
    private _operation;
    private _className;
    /**
     * First input of this block
     */
    a: FlowGraphDataConnection<T1>;
    /**
     * Second input of this block
     */
    b: FlowGraphDataConnection<T2>;
    /**
     * Third input of this block
     */
    c: FlowGraphDataConnection<T3>;
    constructor(t1Type: RichType<T1>, t2Type: RichType<T2>, t3Type: RichType<T3>, resultRichType: RichType<ResultT>, _operation: (a: T1, b: T2, c: T3) => ResultT, _className: string, config?: IFlowGraphBlockConfiguration);
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
