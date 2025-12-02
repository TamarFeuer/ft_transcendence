import { CastingResult } from "./castingResult";
/**
 * Class representing a contact point produced in a proximity cast
 */
export declare class ProximityCastResult extends CastingResult {
    protected _hitDistance: number;
    /**
     * Gets the distance from the hit
     */
    get hitDistance(): number;
    /**
     * Sets the distance from the start point to the hit point
     * @param distance
     */
    setHitDistance(distance: number): void;
    /**
     * Resets all the values to default
     */
    reset(): void;
}
