import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
import { FlowGraphBlock } from "../../flowGraphBlock";
import type { FlowGraphContext } from "../../flowGraphContext";
import type { FlowGraphDataConnection } from "../../flowGraphDataConnection";
import type { IPathToObjectConverter } from "../../../ObjectModel/objectModelInterfaces";
import { FlowGraphPathConverterComponent } from "../../flowGraphPathConverterComponent";
import type { IObjectAccessor } from "../../typeDefinitions";
/**
 * @experimental
 */
export interface IFlowGraphGetPropertyBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The complete path to the property that will be set
     */
    path: string;
    /**
     * The path converter to use to convert the path to an object accessor.
     */
    pathConverter: IPathToObjectConverter<IObjectAccessor>;
}
/**
 * @experimental
 */
export declare class FlowGraphGetPropertyBlock extends FlowGraphBlock {
    /**
     * the configuration of the block
     */
    config: IFlowGraphGetPropertyBlockConfiguration;
    /**
     * Output connection: The value of the property.
     */
    readonly value: FlowGraphDataConnection<any>;
    /**
     * The component with the templated inputs for the provided path.
     */
    readonly templateComponent: FlowGraphPathConverterComponent;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphGetPropertyBlockConfiguration);
    _updateOutputs(context: FlowGraphContext): void;
    /**
     * Gets the class name of this block
     * @returns the class name
     */
    getClassName(): string;
    /**
     * Serializes this block
     * @param serializationObject the object to serialize to
     */
    serialize(serializationObject?: any): void;
    /**
     * Class name of the block.
     */
    static ClassName: string;
}
