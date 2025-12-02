import type { FlowGraphBlock } from "./flowGraphBlock";
import { FlowGraphConnection, FlowGraphConnectionType } from "./flowGraphConnection";
import type { FlowGraphContext } from "./flowGraphContext";
import { RichType } from "./flowGraphRichTypes";
/**
 * @experimental
 * Represents a connection point for data.
 * An unconnected input point can have a default value.
 * An output point will only have a value if it is connected to an input point. Furthermore,
 * if the point belongs to a "function" node, the node will run its function to update the value.
 */
export declare class FlowGraphDataConnection<T> extends FlowGraphConnection<FlowGraphBlock, FlowGraphDataConnection<T>> {
    /**
     * the type of the data in this block
     */
    richType: RichType<T>;
    /**
     * Create a new data connection point.
     * @param name
     * @param connectionType
     * @param ownerBlock
     * @param richType
     */
    constructor(name: string, connectionType: FlowGraphConnectionType, ownerBlock: FlowGraphBlock, 
    /**
     * the type of the data in this block
     */
    richType: RichType<T>);
    /**
     * An output data block can connect to multiple input data blocks,
     * but an input data block can only connect to one output data block.
     * @returns true if the connection is singular
     */
    _isSingularConnection(): boolean;
    /**
     * Set the value of the connection in a specific context.
     * @param value the value to set
     * @param context the context to which the value is set
     */
    setValue(value: T, context: FlowGraphContext): void;
    /**
     * Connect this point to another point.
     * @param point the point to connect to.
     */
    connectTo(point: FlowGraphDataConnection<T>): void;
    private _getValueOrDefault;
    /**
     * Gets the value of the connection in a specific context.
     * @param context the context from which the value is retrieved
     * @returns the value of the connection
     */
    getValue(context: FlowGraphContext): T;
    /**
     * @returns class name of the object.
     */
    getClassName(): string;
    /**
     * Serializes this object.
     * @param serializationObject the object to serialize to
     */
    serialize(serializationObject?: any): void;
    /**
     * Parses a data connection from a serialized object.
     * @param serializationObject the object to parse from
     * @param ownerBlock the block that owns the connection
     * @returns the parsed connection
     */
    static Parse(serializationObject: any, ownerBlock: FlowGraphBlock): FlowGraphDataConnection<any>;
}
