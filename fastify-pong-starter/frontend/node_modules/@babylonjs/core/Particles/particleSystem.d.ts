import { ThinParticleSystem } from "./thinParticleSystem";
import { SubEmitter } from "./subEmitter";
import { Vector3 } from "../Maths/math.vector";
import type { IParticleSystem } from "./IParticleSystem";
import type { Scene } from "../scene";
import { ThinEngine } from "../Engines/thinEngine";
import type { Particle } from "./particle";
import { BoxParticleEmitter } from "./EmitterTypes/boxParticleEmitter";
import { PointParticleEmitter } from "./EmitterTypes/pointParticleEmitter";
import { HemisphericParticleEmitter } from "./EmitterTypes/hemisphericParticleEmitter";
import { SphereDirectedParticleEmitter, SphereParticleEmitter } from "./EmitterTypes/sphereParticleEmitter";
import { CylinderDirectedParticleEmitter, CylinderParticleEmitter } from "./EmitterTypes/cylinderParticleEmitter";
import { ConeParticleEmitter } from "./EmitterTypes/coneParticleEmitter";
/**
 * This represents a particle system in Babylon.
 * Particles are often small sprites used to simulate hard-to-reproduce phenomena like fire, smoke, water, or abstract visual effects like magic glitter and faery dust.
 * Particles can take different shapes while emitted like box, sphere, cone or you can write your custom function.
 * @example https://doc.babylonjs.com/features/featuresDeepDive/particles/particle_system/particle_system_intro
 */
export declare class ParticleSystem extends ThinParticleSystem {
    /**
     * Billboard mode will only apply to Y axis
     */
    static readonly BILLBOARDMODE_Y = 2;
    /**
     * Billboard mode will apply to all axes
     */
    static readonly BILLBOARDMODE_ALL = 7;
    /**
     * Special billboard mode where the particle will be biilboard to the camera but rotated to align with direction
     */
    static readonly BILLBOARDMODE_STRETCHED = 8;
    /**
     * Special billboard mode where the particle will be billboard to the camera but only around the axis of the direction of particle emission
     */
    static readonly BILLBOARDMODE_STRETCHED_LOCAL = 9;
    private _rootParticleSystem;
    /**
     * The Sub-emitters templates that will be used to generate the sub particle system to be associated with the system, this property is used by the root particle system only.
     * When a particle is spawned, an array will be chosen at random and all the emitters in that array will be attached to the particle.  (Default: [])
     */
    subEmitters: Array<ParticleSystem | SubEmitter | Array<SubEmitter>>;
    private _subEmitters;
    /**
     * @internal
     * If the particle systems emitter should be disposed when the particle system is disposed
     */
    _disposeEmitterOnDispose: boolean;
    /**
     * The current active Sub-systems, this property is used by the root particle system only.
     */
    activeSubSystems: Array<ParticleSystem>;
    /**
     * Creates a Point Emitter for the particle system (emits directly from the emitter position)
     * @param direction1 Particles are emitted between the direction1 and direction2 from within the box
     * @param direction2 Particles are emitted between the direction1 and direction2 from within the box
     * @returns the emitter
     */
    createPointEmitter(direction1: Vector3, direction2: Vector3): PointParticleEmitter;
    /**
     * Creates a Hemisphere Emitter for the particle system (emits along the hemisphere radius)
     * @param radius The radius of the hemisphere to emit from
     * @param radiusRange The range of the hemisphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
     * @returns the emitter
     */
    createHemisphericEmitter(radius?: number, radiusRange?: number): HemisphericParticleEmitter;
    /**
     * Creates a Sphere Emitter for the particle system (emits along the sphere radius)
     * @param radius The radius of the sphere to emit from
     * @param radiusRange The range of the sphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
     * @returns the emitter
     */
    createSphereEmitter(radius?: number, radiusRange?: number): SphereParticleEmitter;
    /**
     * Creates a Directed Sphere Emitter for the particle system (emits between direction1 and direction2)
     * @param radius The radius of the sphere to emit from
     * @param direction1 Particles are emitted between the direction1 and direction2 from within the sphere
     * @param direction2 Particles are emitted between the direction1 and direction2 from within the sphere
     * @returns the emitter
     */
    createDirectedSphereEmitter(radius?: number, direction1?: Vector3, direction2?: Vector3): SphereDirectedParticleEmitter;
    /**
     * Creates a Cylinder Emitter for the particle system (emits from the cylinder to the particle position)
     * @param radius The radius of the emission cylinder
     * @param height The height of the emission cylinder
     * @param radiusRange The range of emission [0-1] 0 Surface only, 1 Entire Radius
     * @param directionRandomizer How much to randomize the particle direction [0-1]
     * @returns the emitter
     */
    createCylinderEmitter(radius?: number, height?: number, radiusRange?: number, directionRandomizer?: number): CylinderParticleEmitter;
    /**
     * Creates a Directed Cylinder Emitter for the particle system (emits between direction1 and direction2)
     * @param radius The radius of the cylinder to emit from
     * @param height The height of the emission cylinder
     * @param radiusRange the range of the emission cylinder [0-1] 0 Surface only, 1 Entire Radius (1 by default)
     * @param direction1 Particles are emitted between the direction1 and direction2 from within the cylinder
     * @param direction2 Particles are emitted between the direction1 and direction2 from within the cylinder
     * @returns the emitter
     */
    createDirectedCylinderEmitter(radius?: number, height?: number, radiusRange?: number, direction1?: Vector3, direction2?: Vector3): CylinderDirectedParticleEmitter;
    /**
     * Creates a Cone Emitter for the particle system (emits from the cone to the particle position)
     * @param radius The radius of the cone to emit from
     * @param angle The base angle of the cone
     * @returns the emitter
     */
    createConeEmitter(radius?: number, angle?: number): ConeParticleEmitter;
    /**
     * Creates a Box Emitter for the particle system. (emits between direction1 and direction2 from withing the box defined by minEmitBox and maxEmitBox)
     * @param direction1 Particles are emitted between the direction1 and direction2 from within the box
     * @param direction2 Particles are emitted between the direction1 and direction2 from within the box
     * @param minEmitBox Particles are emitted from the box between minEmitBox and maxEmitBox
     * @param maxEmitBox  Particles are emitted from the box between minEmitBox and maxEmitBox
     * @returns the emitter
     */
    createBoxEmitter(direction1: Vector3, direction2: Vector3, minEmitBox: Vector3, maxEmitBox: Vector3): BoxParticleEmitter;
    private _prepareSubEmitterInternalArray;
    private _stopSubEmitters;
    private _removeFromRoot;
    _emitFromParticle: (particle: Particle) => void;
    _preStart(): void;
    _postStop(stopSubEmitters: boolean): void;
    _prepareParticle(particle: Particle): void;
    /** @internal */
    _onDispose(disposeAttachedSubEmitters?: boolean, disposeEndSubEmitters?: boolean): void;
    /**
     * @internal
     */
    static _Parse(parsedParticleSystem: any, particleSystem: IParticleSystem, sceneOrEngine: Scene | ThinEngine, rootUrl: string): void;
    /**
     * Parses a JSON object to create a particle system.
     * @param parsedParticleSystem The JSON object to parse
     * @param sceneOrEngine The scene or the engine to create the particle system in
     * @param rootUrl The root url to use to load external dependencies like texture
     * @param doNotStart Ignore the preventAutoStart attribute and does not start
     * @param capacity defines the system capacity (if null or undefined the sotred capacity will be used)
     * @returns the Parsed particle system
     */
    static Parse(parsedParticleSystem: any, sceneOrEngine: Scene | ThinEngine, rootUrl: string, doNotStart?: boolean, capacity?: number): ParticleSystem;
    /**
     * Serializes the particle system to a JSON object
     * @param serializeTexture defines if the texture must be serialized as well
     * @returns the JSON object
     */
    serialize(serializeTexture?: boolean): any;
    /**
     * @internal
     */
    static _Serialize(serializationObject: any, particleSystem: IParticleSystem, serializeTexture: boolean): void;
    /**
     * Clones the particle system.
     * @param name The name of the cloned object
     * @param newEmitter The new emitter to use
     * @param cloneTexture Also clone the textures if true
     * @returns the cloned particle system
     */
    clone(name: string, newEmitter: any, cloneTexture?: boolean): ParticleSystem;
}
