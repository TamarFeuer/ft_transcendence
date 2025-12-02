// Do not edit.
import { ShaderStore } from "../Engines/shaderStore.js";
import "./ShadersInclude/clipPlaneFragmentDeclaration.js";
import "./ShadersInclude/logDepthDeclaration.js";
import "./ShadersInclude/fogFragmentDeclaration.js";
import "./ShadersInclude/clipPlaneFragment.js";
import "./ShadersInclude/logDepthFragment.js";
import "./ShadersInclude/fogFragment.js";
const name = "gaussianSplattingPixelShader";
const shader = `#include<clipPlaneFragmentDeclaration>
#include<logDepthDeclaration>
#include<fogFragmentDeclaration>
varying vec4 vColor;varying vec2 vPosition;void main () { 
#include<clipPlaneFragment>
float A=-dot(vPosition,vPosition);if (A<-4.0) discard;float B=exp(A)*vColor.a;
#include<logDepthFragment>
vec3 color=vColor.rgb;
#ifdef FOG
#include<fogFragment>
#endif
gl_FragColor=vec4(color,B);}
`;
// Sideeffect
ShaderStore.ShadersStore[name] = shader;
/** @internal */
export const gaussianSplattingPixelShader = { name, shader };
//# sourceMappingURL=gaussianSplatting.fragment.js.map