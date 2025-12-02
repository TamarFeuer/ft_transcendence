import type { Skeleton } from "../../Bones/skeleton";
import { Vector3 } from "../../Maths/math.vector";
import { PhysicsAggregate } from "./physicsAggregate";
import type { Mesh } from "../../Meshes/mesh";
import { TransformNode } from "../../Meshes/transformNode";
/**
 * Ragdoll bone properties
 * @experimental
 */
export declare class RagdollBoneProperties {
    /**
     * Width of the box shape
     */
    width?: number;
    /**
     * depth of the box shape
     */
    depth?: number;
    /**
     * height of the box shape
     */
    height?: number;
    /**
     * size that will be used of width, depth and height of the shape box
     */
    size?: number;
    /**
     * Type of Physics Constraint used between bones
     */
    joint?: number | undefined;
    /**
     * Main rotation axis used by the constraint, in local space
     */
    rotationAxis?: Vector3;
    /**
     * Minimum rotation angle value
     */
    min?: number;
    /**
     * Maximum rotation angle value
     */
    max?: number;
    /**
     * Offset along local axis
     */
    boxOffset?: number;
    /**
     * Axis that need an offset
     */
    boneOffsetAxis?: Vector3;
}
/**
 * Ragdoll for Physics V2
 * @experimental
 */
export declare class Ragdoll {
    private _skeleton;
    private _scene;
    private _rootTransformNode;
    private _config;
    private _boxConfigs;
    private _joints;
    private _bones;
    private _initialRotation;
    private _initialRotation2;
    private _boneNames;
    private _transforms;
    private _aggregates;
    private _ragdollMode;
    private _rootBoneName;
    private _rootBoneIndex;
    private _mass;
    private _restitution;
    /**
     * Pause synchronization between physics and bone position/orientation
     */
    pauseSync: boolean;
    private _putBoxesInBoneCenter;
    private _defaultJoint;
    private _defaultJointMin;
    private _defaultJointMax;
    /**
     * Construct a new Ragdoll object. Once ready, it can be made dynamic by calling `Ragdoll` method
     * @param skeleton The skeleton containing bones to be physicalized
     * @param rootTransformNode The mesh or its transform used by the skeleton
     * @param config an array of `RagdollBoneProperties` corresponding to bones and their properties used to instanciate physics bodies
     */
    constructor(skeleton: Skeleton, rootTransformNode: Mesh | TransformNode, config: RagdollBoneProperties[]);
    /**
     * Returns the aggregate corresponding to the ragdoll bone index
     * @param index ragdoll bone aggregate index
     * @returns the aggregate for the bone index for the root aggregate if index is invalid
     */
    getAggregate(index: number): PhysicsAggregate;
    private _createColliders;
    private _initJoints;
    private _syncBonesToPhysics;
    private _setBoneOrientationToBody;
    private _syncBonesAndBoxes;
    private _setBodyOrientationToBone;
    private _defineRootBone;
    private _findNearestParent;
    private _init;
    /**
     * Enable ragdoll mode. Create physics objects and make them dynamic.
     */
    ragdoll(): void;
    /**
     * Dispose resources and remove physics objects
     */
    dispose(): void;
}
