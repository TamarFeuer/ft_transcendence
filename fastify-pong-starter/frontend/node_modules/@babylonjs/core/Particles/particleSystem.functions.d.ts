import { Vector3 } from "../Maths/math.vector.js";
import { PointParticleEmitter } from "./EmitterTypes/pointParticleEmitter";
import { HemisphericParticleEmitter } from "./EmitterTypes/hemisphericParticleEmitter";
import { SphereDirectedParticleEmitter, SphereParticleEmitter } from "./EmitterTypes/sphereParticleEmitter";
import { CylinderDirectedParticleEmitter, CylinderParticleEmitter } from "./EmitterTypes/cylinderParticleEmitter";
import { ConeParticleEmitter } from "./EmitterTypes/coneParticleEmitter";
/**
 * Creates a Point Emitter for the particle system (emits directly from the emitter position)
 * @param direction1 Particles are emitted between the direction1 and direction2 from within the box
 * @param direction2 Particles are emitted between the direction1 and direction2 from within the box
 * @returns the emitter
 */
export declare function CreatePointEmitter(direction1: Vector3, direction2: Vector3): PointParticleEmitter;
/**
 * Creates a Hemisphere Emitter for the particle system (emits along the hemisphere radius)
 * @param radius The radius of the hemisphere to emit from
 * @param radiusRange The range of the hemisphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
 * @returns the emitter
 */
export declare function CreateHemisphericEmitter(radius?: number, radiusRange?: number): HemisphericParticleEmitter;
/**
 * Creates a Sphere Emitter for the particle system (emits along the sphere radius)
 * @param radius The radius of the sphere to emit from
 * @param radiusRange The range of the sphere to emit from [0-1] 0 Surface Only, 1 Entire Radius
 * @returns the emitter
 */
export declare function CreateSphereEmitter(radius?: number, radiusRange?: number): SphereParticleEmitter;
/**
 * Creates a Directed Sphere Emitter for the particle system (emits between direction1 and direction2)
 * @param radius The radius of the sphere to emit from
 * @param direction1 Particles are emitted between the direction1 and direction2 from within the sphere
 * @param direction2 Particles are emitted between the direction1 and direction2 from within the sphere
 * @returns the emitter
 */
export declare function CreateDirectedSphereEmitter(radius?: number, direction1?: Vector3, direction2?: Vector3): SphereDirectedParticleEmitter;
/**
 * Creates a Cylinder Emitter for the particle system (emits from the cylinder to the particle position)
 * @param radius The radius of the emission cylinder
 * @param height The height of the emission cylinder
 * @param radiusRange The range of emission [0-1] 0 Surface only, 1 Entire Radius
 * @param directionRandomizer How much to randomize the particle direction [0-1]
 * @returns the emitter
 */
export declare function CreateCylinderEmitter(radius?: number, height?: number, radiusRange?: number, directionRandomizer?: number): CylinderParticleEmitter;
/**
 * Creates a Directed Cylinder Emitter for the particle system (emits between direction1 and direction2)
 * @param radius The radius of the cylinder to emit from
 * @param height The height of the emission cylinder
 * @param radiusRange the range of the emission cylinder [0-1] 0 Surface only, 1 Entire Radius (1 by default)
 * @param direction1 Particles are emitted between the direction1 and direction2 from within the cylinder
 * @param direction2 Particles are emitted between the direction1 and direction2 from within the cylinder
 * @returns the emitter
 */
export declare function CreateDirectedCylinderEmitter(radius?: number, height?: number, radiusRange?: number, direction1?: Vector3, direction2?: Vector3): CylinderDirectedParticleEmitter;
/**
 * Creates a Cone Emitter for the particle system (emits from the cone to the particle position)
 * @param radius The radius of the cone to emit from
 * @param angle The base angle of the cone
 * @returns the emitter
 */
export declare function CreateConeEmitter(radius?: number, angle?: number): ConeParticleEmitter;
