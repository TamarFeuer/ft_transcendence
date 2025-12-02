import { AbstractMesh } from "../../../Meshes/abstractMesh";
import { FlowGraphEventBlock } from "../../flowGraphEventBlock";
import type { FlowGraphContext } from "../../flowGraphContext";
import type { IFlowGraphBlockConfiguration } from "../../flowGraphBlock";
import type { IPathToObjectConverter } from "../../../ObjectModel/objectModelInterfaces";
import type { IObjectAccessor } from "../../typeDefinitions";
/**
 * @experimental
 */
export interface IFlowGraphMeshPickEventBlockConfiguration extends IFlowGraphBlockConfiguration {
    /**
     * The path of the mesh to pick.
     */
    path: string;
    /**
     * The path converter to use to convert the path to an object accessor.
     */
    pathConverter: IPathToObjectConverter<IObjectAccessor>;
}
/**
 * @experimental
 * A block that activates when a mesh is picked.
 */
export declare class FlowGraphMeshPickEventBlock extends FlowGraphEventBlock {
    /**
     * the configuration of the block
     */
    config: IFlowGraphMeshPickEventBlockConfiguration;
    constructor(
    /**
     * the configuration of the block
     */
    config: IFlowGraphMeshPickEventBlockConfiguration);
    _getReferencedMesh(): AbstractMesh;
    /**
     * @internal
     */
    _preparePendingTasks(context: FlowGraphContext): void;
    _onDispose(context: FlowGraphContext): void;
    /**
     * @internal
     */
    _cancelPendingTasks(context: FlowGraphContext): void;
    /**
     * @returns class name of the block.
     */
    getClassName(): string;
    /**
     * Serializes the block to a JSON object.
     * @param serializationObject the object to serialize to.
     */
    serialize(serializationObject?: any): void;
    /**
     * Class name of the block.
     */
    static ClassName: string;
}
