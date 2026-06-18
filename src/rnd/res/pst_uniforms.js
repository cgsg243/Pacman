export function pst_createUniforms(device)
{
    const buffer = device.createBuffer({
        size: 64, // 1 матрица
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const layout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
        ],
    });

    const group = device.createBindGroup({
        layout,
        entries: [
            { binding: 0, resource: { buffer } },
        ],
    });

    const data = new Float32Array(16); // только model

    return { buffer, layout, group, data };
}