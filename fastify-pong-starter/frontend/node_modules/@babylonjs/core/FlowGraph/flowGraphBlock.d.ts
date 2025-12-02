import type { FlowGraphContext } from "./flowGraphContext";
import { FlowGraphDataConnection } from "./flowGraphDataConnection";
import type { RichType } from "./flowGraphRichTypes";
import type { ISerializedFlowGraphBlock, IObjectAccessor } from "./typeDefinitions";
import type { Scene } from "../scene";
import type { IPathToObjectConverter } from "../ObjectModel/objectModelInterfaces";
/**
 * @experimental
 * Options for parsing a block.
 */
export interface IFlowGraphBlockParseOptions {
    /**
     * A function that parses a value from a serialization object.
     * @param key the key of the property
     * @param serializationObject the serialization object where the property is located
     * @param scene the scene that the block is being parsed in
     * @returns the parsed value
     */
    valueParseFunction?: (key: string, serializationObject: any, scene: Scene) => any;
    /**
     * The scene that the block is being parsed in.
     */
    scene: Scene;
    /**
     * The path converter to use to convert the path to an object accessor.
     */
    pathConverter: IPathToObjectConverter<IObjectAccessor>;
}
/**
 * @experimental
 * Configuration for a block.
 */
export interface IFlowGraphBlockConfiguration {
    /**
     * The name of the block.
     */
    name?: string;
    [extraPropertyKey: string]: any;
}
/**
 * @experimental
 * A block in a flow graph. The most basic form
 * of a block has inputs and outputs that contain
 * data.
 */
export declare class FlowGraphBlock {
    /**
     * the configuration of the block
     */
    config?: IFlowGraphBlockConfiguration | undefined;
    /**
     * A randomly generated GUID for each block.
     */
    uniqueId: string;
    /**
     * The name of the block.
     */
    name: string;
    /**
     * The data inputs of the block.
     */
    dataInputs: FlowGraphDataConnection<any>[];
    /**
     * The data outputs of the block.
     */
    dataOutputs: FlowGraphDataConnection<any>[];
    /**
     * Metadata that can be used by the block.
     */
    metadata: any;
    /** Constructor is protected so only subclasses can be instantiated
     * @param config optional configuration for this block
     */
    protected constructor(
    /**
     * the configuration of the block
     */
    config?: IFlowGraphBlockConfiguration | undefined);
    /**
     * @internal
     */
    _updateOutputs(_context: FlowGraphContext): void;
    /**
     * Registers a data input on the block.
     * @param name the name of the input
     * @param richType the type of the input
     * @returns the created connection
     */
    registerDataInput<T>(name: string, richType: RichType<T>): FlowGraphDataConnection<T>;
    /**
     * Registers a data output on the block.
     * @param name the name of the input
     * @param richType the type of the input
     * @returns the created connection
     */
    registerDataOutput<T>(name: string, richType: RichType<T>): FlowGraphDataConnection<T>;
    /**
     * Given the name of a data input, returns the connection if it exists
     * @param name the name of the input
     * @returns the connection if it exists, undefined otherwise
     */
    getDataInput(name: string): FlowGraphDataConnection<any> | undefined;
    /**
     * Given the name of a data output, returns the connection if it exists
     * @param name the name of the output
     * @returns the connection if it exists, undefined otherwise
     */
    getDataOutput(name: string): FlowGraphDataConnection<any> | undefined;
    /**
     * Serializes this block
     * @param serializationObject the object to serialize to
     * @param _valueSerializeFunction a function that serializes a specific value
     */
    serialize(serializationObject?: any, _valueSerializeFunction?: (key: string, value: any, serializationObject: any) => any): void;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Parses a block from a serialization object
     * @param serializationObject the object to parse from
     * @param parseOptions options for parsing the block
     * @returns the parsed block
     */
    static Parse(serializationObject: ISerializedFlowGraphBlock, parseOptions: IFlowGraphBlockParseOptions): FlowGraphBlock;
}
