export function pst_createShaderModule(device)
{
    return device.createShaderModule({
        code: `
            struct Uniforms
            {
                model: mat4x4f,
            }
            @group(0) @binding(0) var<uniform> u: Uniforms;

            @vertex
            fn vs(@location(0) pos: vec3f) -> @builtin(position) vec4f
            {
                return u.model * vec4f(pos, 1.0);
            }

            @fragment
            fn fs() -> @location(0) vec4f
            {
               return vec4f(0.2, 0.2, 0.8, 1.0);
            }
        `
    });
}
    