import { Matrix } from "../Maths/math.vector.js";

import { ShaderMaterial } from "../Materials/shaderMaterial.js";
import { RenderTargetTexture } from "../Materials/Textures/renderTargetTexture.js";
import { Color4 } from "../Maths/math.color.js";
import { PostProcess } from "../PostProcesses/postProcess.js";
import "../Shaders/meshUVSpaceRenderer.vertex.js";
import "../Shaders/meshUVSpaceRenderer.fragment.js";
import "../Shaders/meshUVSpaceRendererMasker.vertex.js";
import "../Shaders/meshUVSpaceRendererMasker.fragment.js";
import "../Shaders/meshUVSpaceRendererFinaliser.fragment.js";
import "../Shaders/meshUVSpaceRendererFinaliser.vertex.js";
/**
 * Class used to render in the mesh UV space
 * @since 5.49.1
 */
export class MeshUVSpaceRenderer {
    static _GetShader(scene) {
        if (!scene._meshUVSpaceRendererShader) {
            const shader = new ShaderMaterial("meshUVSpaceRendererShader", scene, {
                vertex: "meshUVSpaceRenderer",
                fragment: "meshUVSpaceRenderer",
            }, {
                attributes: ["position", "normal", "uv"],
                uniforms: ["world", "projMatrix"],
                samplers: ["textureSampler"],
                needAlphaBlending: true,
            });
            shader.backFaceCulling = false;
            shader.alphaMode = 2;
            scene.onDisposeObservable.add(() => {
                scene._meshUVSpaceRendererShader?.dispose();
                scene._meshUVSpaceRendererShader = null;
            });
            scene._meshUVSpaceRendererShader = shader;
        }
        return scene._meshUVSpaceRendererShader;
    }
    static _GetMaskShader(scene) {
        if (!scene._meshUVSpaceRendererMaskShader) {
            const shader = new ShaderMaterial("meshUVSpaceRendererMaskShader", scene, {
                vertex: "meshUVSpaceRendererMasker",
                fragment: "meshUVSpaceRendererMasker",
            }, {
                attributes: ["position", "uv"],
                uniforms: ["worldViewProjection"],
            });
            shader.backFaceCulling = false;
            shader.alphaMode = 2;
            scene.onDisposeObservable.add(() => {
                scene._meshUVSpaceRendererMaskShader?.dispose();
                scene._meshUVSpaceRendererMaskShader = null;
            });
            scene._meshUVSpaceRendererMaskShader = shader;
        }
        return scene._meshUVSpaceRendererMaskShader;
    }
    static _IsRenderTargetTexture(texture) {
        return texture.renderList !== undefined;
    }
    /**
     * Creates a new MeshUVSpaceRenderer
     * @param mesh The mesh used for the source UV space
     * @param scene The scene the mesh belongs to
     * @param options The options to use when creating the texture
     */
    constructor(mesh, scene, options) {
        this._textureCreatedInternally = false;
        this._configureUserCreatedTexture = true;
        this._maskTexture = null;
        this._finalPostProcess = null;
        /**
         * Clear color of the texture
         */
        this.clearColor = new Color4(0, 0, 0, 0);
        this._mesh = mesh;
        this._scene = scene;
        this._options = {
            width: 1024,
            height: 1024,
            textureType: 0,
            generateMipMaps: true,
            optimizeUVAllocation: true,
            uvEdgeBlending: false,
            ...options,
        };
    }
    /**
     * Checks if the texture is ready to be used
     * @returns true if the texture is ready to be used
     */
    isReady() {
        if (!this.texture) {
            this._createDiffuseRTT();
        }
        const textureIsReady = MeshUVSpaceRenderer._IsRenderTargetTexture(this.texture) ? this.texture.isReadyForRendering() : this.texture.isReady();
        const maskIsReady = this._maskTexture?.isReadyForRendering() ?? true;
        const postProcessIsReady = this._finalPostProcess?.isReady() ?? true;
        return textureIsReady && maskIsReady && postProcessIsReady;
    }
    /**
     * Projects and renders a texture in the mesh UV space
     * @param texture The texture
     * @param position The position of the center of projection (world space coordinates)
     * @param normal The direction of the projection (world space coordinates)
     * @param size The size of the projection
     * @param angle The rotation angle around the direction of the projection
     */
    renderTexture(texture, position, normal, size, angle = 0) {
        if (!this.texture) {
            this._createDiffuseRTT();
        }
        else if (this._configureUserCreatedTexture) {
            this._configureUserCreatedRTT();
        }
        if (MeshUVSpaceRenderer._IsRenderTargetTexture(this.texture)) {
            const matrix = this._createProjectionMatrix(position, normal, size, angle);
            const shader = MeshUVSpaceRenderer._GetShader(this._scene);
            shader.setTexture("textureSampler", texture);
            shader.setMatrix("projMatrix", matrix);
            this.texture.render();
        }
    }
    /**
     * Clears the texture map
     */
    clear() {
        if (MeshUVSpaceRenderer._IsRenderTargetTexture(this.texture) && this.texture.renderTarget) {
            const engine = this._scene.getEngine();
            engine.bindFramebuffer(this.texture.renderTarget);
            engine.clear(this.clearColor, true, true, true);
            engine.unBindFramebuffer(this.texture.renderTarget);
        }
        if (this._finalPostProcess?.inputTexture) {
            const engine = this._scene.getEngine();
            engine.bindFramebuffer(this._finalPostProcess?.inputTexture);
            engine.clear(this.clearColor, true, true, true);
            engine.unBindFramebuffer(this._finalPostProcess?.inputTexture);
        }
    }
    /**
     * Disposes of the resources
     */
    dispose() {
        if (this._textureCreatedInternally) {
            this.texture.dispose();
            this._textureCreatedInternally = false;
        }
        this._configureUserCreatedTexture = true;
        this._maskTexture?.dispose();
        this._maskTexture = null;
        this._finalPostProcess?.dispose();
        this._finalPostProcess = null;
    }
    _configureUserCreatedRTT() {
        this._configureUserCreatedTexture = false;
        if (MeshUVSpaceRenderer._IsRenderTargetTexture(this.texture)) {
            this.texture.setMaterialForRendering(this._mesh, MeshUVSpaceRenderer._GetShader(this._scene));
            this.texture.onClearObservable.add(() => { });
            this.texture.renderList = [this._mesh];
            if (this._options.uvEdgeBlending) {
                this._createMaskTexture();
                this._createPostProcess();
                this.texture.addPostProcess(this._finalPostProcess);
            }
        }
    }
    _createDiffuseRTT() {
        this._textureCreatedInternally = true;
        const texture = this._createRenderTargetTexture(this._options.width, this._options.height);
        texture.setMaterialForRendering(this._mesh, MeshUVSpaceRenderer._GetShader(this._scene));
        this.texture = texture;
        this._configureUserCreatedTexture = false;
        if (this._options.uvEdgeBlending) {
            this._createMaskTexture();
            this._createPostProcess();
            texture.addPostProcess(this._finalPostProcess);
        }
    }
    _createMaskTexture() {
        if (this._maskTexture) {
            return;
        }
        this._maskTexture = new RenderTargetTexture(this._mesh.name + "_maskTexture", { width: this._options.width, height: this._options.height }, this._scene, false, // No mipmaps for the mask texture
        true, 0, false, 2, undefined, undefined, undefined, 6);
        this._maskTexture.clearColor = new Color4(0, 0, 0, 0);
        // Render the mesh with the mask material to the mask texture
        this._maskTexture.renderList.push(this._mesh);
        this._maskTexture.setMaterialForRendering(this._mesh, MeshUVSpaceRenderer._GetMaskShader(this._scene));
        // Ensure the mask texture is updated
        this._maskTexture.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
        this._scene.customRenderTargets.push(this._maskTexture);
    }
    _createPostProcess() {
        if (this._finalPostProcess) {
            return;
        }
        this._finalPostProcess = new PostProcess(this._mesh.name + "_fixSeamsPostProcess", "meshUVSpaceRendererFinaliser", ["textureSize"], ["textureSampler", "maskTextureSampler"], 1.0, null, 1, this._scene.getEngine(), false, null, this._options.textureType);
        this._finalPostProcess.onApplyObservable.add((effect) => {
            effect.setTexture("maskTextureSampler", this._maskTexture);
            effect.setFloat2("textureSize", this._options.width, this._options.height);
        });
    }
    _createRenderTargetTexture(width, height) {
        const rtt = new RenderTargetTexture(this._mesh.name + "_uvspaceTexture", { width, height }, this._scene, this._options.generateMipMaps, true, this._options.textureType, false, this._options.generateMipMaps ? 3 : 2, false, false, false, 5);
        rtt.renderParticles = false;
        rtt.optimizeUVAllocation = !!this._options.optimizeUVAllocation;
        rtt.onClearObservable.addOnce(() => {
            this._scene.getEngine().clear(this.clearColor, true, true, true);
            rtt.onClearObservable.add(() => { }); // this disables clearing the texture for the next frames
        });
        rtt.renderList = [this._mesh];
        return rtt;
    }
    _createProjectionMatrix(position, normal, size, angle = 0) {
        const yaw = -Math.atan2(normal.z, normal.x) - Math.PI / 2;
        const len = Math.sqrt(normal.x * normal.x + normal.z * normal.z);
        const pitch = Math.atan2(normal.y, len);
        const p = position.add(normal.scale(size.z * 0.5));
        const projWorldMatrix = Matrix.RotationYawPitchRoll(yaw, pitch, angle).multiply(Matrix.Translation(p.x, p.y, p.z));
        const inverseProjWorldMatrix = Matrix.Invert(projWorldMatrix);
        const projMatrix = Matrix.FromArray([2 / size.x, 0, 0, 0, 0, 2 / size.y, 0, 0, 0, 0, 1 / size.z, 0, 0, 0, 0, 1]);
        const screenMatrix = Matrix.FromArray([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 1, 0, 0.5, 0.5, 0.0, 1]);
        return inverseProjWorldMatrix.multiply(projMatrix).multiply(screenMatrix);
    }
}
//# sourceMappingURL=meshUVSpaceRenderer.js.map