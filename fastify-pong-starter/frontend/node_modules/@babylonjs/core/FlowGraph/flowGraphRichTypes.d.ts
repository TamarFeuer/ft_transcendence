import { Vector2, Vector3, Vector4, Matrix, Quaternion } from "../Maths/math.vector";
import { Color3, Color4 } from "../Maths/math.color";
import { FlowGraphInteger } from "./flowGraphInteger";
/**
 * A rich type represents extra information about a type,
 * such as its name and a default value constructor.
 * @experimental
 */
export declare class RichType<T> {
    /**
     * The name given to the type.
     */
    typeName: string;
    /**
     * The default value of the type.
     */
    defaultValue: T;
    constructor(
    /**
     * The name given to the type.
     */
    typeName: string, 
    /**
     * The default value of the type.
     */
    defaultValue: T);
    /**
     * Serializes this rich type into a serialization object.
     * @param serializationObject the object to serialize to
     */
    serialize(serializationObject: any): void;
    /**
     * Parses a rich type from a serialization object.
     * @param serializationObject a serialization object
     * @returns the parsed rich type
     */
    static Parse(serializationObject: any): RichType<any>;
}
export declare const RichTypeAny: RichType<any>;
export declare const RichTypeString: RichType<string>;
export declare const RichTypeNumber: RichType<number>;
export declare const RichTypeBoolean: RichType<boolean>;
export declare const RichTypeVector2: RichType<Vector2>;
export declare const RichTypeVector3: RichType<Vector3>;
export declare const RichTypeVector4: RichType<Vector4>;
export declare const RichTypeMatrix: RichType<Matrix>;
export declare const RichTypeColor3: RichType<Color3>;
export declare const RichTypeColor4: RichType<Color4>;
export declare const RichTypeQuaternion: RichType<Quaternion>;
export declare const RichTypeFlowGraphInteger: RichType<FlowGraphInteger>;
/**
 * Given a value, try to deduce its rich type.
 * @param value the value to deduce the rich type from
 * @returns the value's rich type, or RichTypeAny if the type could not be deduced.
 */
export declare function getRichTypeFromValue<T>(value: T): RichType<T>;
