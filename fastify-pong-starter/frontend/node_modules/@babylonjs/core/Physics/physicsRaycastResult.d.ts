import { Vector3 } from "../Maths/math.vector";
import { CastingResult } from "./castingResult";
/**
 * Interface for query parameters in the raycast function.
 * @see the "Collision Filtering" section in https://github.com/eoineoineoin/glTF/tree/MSFT_RigidBodies/extensions/2.0/Vendor/MSFT_collision_primitives
 */
export interface IRaycastQuery {
    /** Membership mask */
    membership?: number;
    /** CollideWith mask */
    collideWith?: number;
}
/**
 * Holds the data for the raycast result
 * @see https://doc.babylonjs.com/features/featuresDeepDive/physics/usingPhysicsEngine
 */
export declare class PhysicsRaycastResult extends CastingResult {
    private _hitDistance;
    private _rayFromWorld;
    private _rayToWorld;
    /**
     * Gets the distance from the hit
     */
    get hitDistance(): number;
    /**
     * Gets the hit normal/direction in the world
     */
    get hitNormalWorld(): Vector3;
    /**
     * Gets the hit point in the world
     */
    get hitPointWorld(): Vector3;
    /**
     * Gets the ray "start point" of the ray in the world
     */
    get rayFromWorld(): Vector3;
    /**
     * Gets the ray "end point" of the ray in the world
     */
    get rayToWorld(): Vector3;
    /**
     * Sets the distance from the start point to the hit point
     * @param distance defines the distance to set
     */
    setHitDistance(distance: number): void;
    /**
     * Calculates the distance manually
     */
    calculateHitDistance(): void;
    /**
     * Resets all the values to default
     * @param from The from point on world space
     * @param to The to point on world space
     */
    reset(from?: Vector3, to?: Vector3): void;
}
