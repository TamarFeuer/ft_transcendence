// Do not edit.
import { ShaderStore } from "../../Engines/shaderStore.js";
const name = "gaussianSplattingVertexDeclaration";
const shader = `uniform mat4 world;uniform mat4 view;uniform mat4 projection;
`;
// Sideeffect
ShaderStore.IncludesShadersStore[name] = shader;
/** @internal */
export const gaussianSplattingVertexDeclaration = { name, shader };
//# sourceMappingURL=gaussianSplattingVertexDeclaration.js.map