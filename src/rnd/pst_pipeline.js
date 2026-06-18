export function pst_createPipeline(device, shader, bindGroupLayout, format)
{
    const layout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    return device.createRenderPipeline({
        layout,
        vertex: {
            module: shader,
            entryPoint: 'vs',
            buffers: [{
                arrayStride: 12,
                attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
            }],
        },
        fragment: {
            module: shader,
            entryPoint: 'fs',
            targets: [{ format }],
        },
        primitive: { topology: 'triangle-list' },
    });
}