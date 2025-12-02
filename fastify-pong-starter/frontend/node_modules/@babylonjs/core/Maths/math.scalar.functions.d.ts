/**
 * Extract int value
 * @param value number value
 * @returns int value
 */
export declare function ExtractAsInt(value: number): number;
/**
 * Boolean : true if the absolute difference between a and b is lower than epsilon (default = 1.401298E-45)
 * @param a number
 * @param b number
 * @param epsilon (default = 1.401298E-45)
 * @returns true if the absolute difference between a and b is lower than epsilon (default = 1.401298E-45)
 */
export declare function WithinEpsilon(a: number, b: number, epsilon?: number): boolean;
/**
 * Returns a random float number between and min and max values
 * @param min min value of random
 * @param max max value of random
 * @returns random value
 */
export declare function RandomRange(min: number, max: number): number;
/**
 * Creates a new scalar with values linearly interpolated of "amount" between the start scalar and the end scalar.
 * @param start start value
 * @param end target value
 * @param amount amount to lerp between
 * @returns the lerped value
 */
export declare function Lerp(start: number, end: number, amount: number): number;
/**
 * Returns the value itself if it's between min and max.
 * Returns min if the value is lower than min.
 * Returns max if the value is greater than max.
 * @param value the value to clmap
 * @param min the min value to clamp to (default: 0)
 * @param max the max value to clamp to (default: 1)
 * @returns the clamped value
 */
export declare function Clamp(value: number, min?: number, max?: number): number;
/**
 * Returns the angle converted to equivalent value between -Math.PI and Math.PI radians.
 * @param angle The angle to normalize in radian.
 * @returns The converted angle.
 */
export declare function NormalizeRadians(angle: number): number;
/**
 * Returns a string : the upper case translation of the number i to hexadecimal.
 * @param i number
 * @returns the upper case translation of the number i to hexadecimal.
 */
export declare function ToHex(i: number): string;
