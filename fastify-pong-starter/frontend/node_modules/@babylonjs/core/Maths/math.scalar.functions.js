/**
 * Extract int value
 * @param value number value
 * @returns int value
 */
export function ExtractAsInt(value) {
    return parseInt(value.toString().replace(/\W/g, ""));
}
/**
 * Boolean : true if the absolute difference between a and b is lower than epsilon (default = 1.401298E-45)
 * @param a number
 * @param b number
 * @param epsilon (default = 1.401298E-45)
 * @returns true if the absolute difference between a and b is lower than epsilon (default = 1.401298E-45)
 */
export function WithinEpsilon(a, b, epsilon = 1.401298e-45) {
    return Math.abs(a - b) <= epsilon;
}
/**
 * Returns a random float number between and min and max values
 * @param min min value of random
 * @param max max value of random
 * @returns random value
 */
export function RandomRange(min, max) {
    if (min === max) {
        return min;
    }
    return Math.random() * (max - min) + min;
}
/**
 * Creates a new scalar with values linearly interpolated of "amount" between the start scalar and the end scalar.
 * @param start start value
 * @param end target value
 * @param amount amount to lerp between
 * @returns the lerped value
 */
export function Lerp(start, end, amount) {
    return start + (end - start) * amount;
}
/**
 * Returns the value itself if it's between min and max.
 * Returns min if the value is lower than min.
 * Returns max if the value is greater than max.
 * @param value the value to clmap
 * @param min the min value to clamp to (default: 0)
 * @param max the max value to clamp to (default: 1)
 * @returns the clamped value
 */
export function Clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
}
/**
 * Returns the angle converted to equivalent value between -Math.PI and Math.PI radians.
 * @param angle The angle to normalize in radian.
 * @returns The converted angle.
 */
export function NormalizeRadians(angle) {
    // More precise but slower version kept for reference.
    // angle = angle % Tools.TwoPi;
    // angle = (angle + Tools.TwoPi) % Tools.TwoPi;
    //if (angle > Math.PI) {
    //	angle -= Tools.TwoPi;
    //}
    angle -= Math.PI * 2 * Math.floor((angle + Math.PI) / (Math.PI * 2));
    return angle;
}
/**
 * Returns a string : the upper case translation of the number i to hexadecimal.
 * @param i number
 * @returns the upper case translation of the number i to hexadecimal.
 */
export function ToHex(i) {
    const str = i.toString(16);
    if (i <= 15) {
        return ("0" + str).toUpperCase();
    }
    return str.toUpperCase();
}
//# sourceMappingURL=math.scalar.functions.js.map