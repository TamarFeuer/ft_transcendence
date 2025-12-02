import { Vector3 } from "../Maths/math.vector";
import type { PhysicsShape } from "./v2/physicsShape";
import type { PhysicsBody } from "./v2/physicsBody";
/**
 * Base class for results of casts.
 */
export declare class CastingResult {
    private _hasHit;
    protected _hitNormal: Vector3;
    protected _hitPoint: Vector3;
    private _triangleIndex;
    /**
     * The Physics body that the query hit.
     */
    body?: PhysicsBody;
    /**
     * The body Index in case the Physics body is using instances
     */
    bodyIndex?: number;
    /**
     * The shape hit by the query.
     */
    shape?: PhysicsShape;
    /**
     * Gets the hit point.
     */
    get hitPoint(): Vector3;
    /**
     * Gets the hit normal.
     */
    get hitNormal(): Vector3;
    /**
     * Gets if there was a hit
     */
    get hasHit(): boolean;
    get triangleIndex(): number;
    /**
     * Sets the hit data
     * @param hitNormal defines the normal in world space
     * @param hitPoint defines the point in world space
     * @param triangleIndex defines the index of the triangle in case of mesh shape
     */
    setHitData(hitNormal: IXYZ, hitPoint: IXYZ, triangleIndex?: number): void;
    /**
     * Resets all the values to default
     */
    reset(): void;
}
/**
 * Interface for the size containing width and height
 */
interface IXYZ {
    /**
     * X
     */
    x: number;
    /**
     * Y
     */
    y: number;
    /**
     * Z
     */
    z: number;
}
export {};
