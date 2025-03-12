import { createHandler } from "./src/handle.ts";
import { transformDir } from "./src/utils.ts";
import { rm } from 'node:fs/promises'

await rm('out', { recursive: true, force: true })

const rpcHandler = createHandler({
    srcDir: 'src',
    outDir: 'out',
    callImportType: 'file'
})

Deno.serve({
    port: 8000
}, request => {
    if (request.url.endsWith('favicon.ico') || request.url.endsWith('/'))
        return new Response(null, { status: 204 })
    return rpcHandler(request)
});


// transformDir('src', 'out', {
//     sourceMap: true,
//     format: 'javascript',
//     callImportType: 'file',
//     callImportFileName: 'lib/rpc.ts'
// });

// processDirectory('src', 'out', {
//     sourceMap: true,
//     format: 'typescript',
//     // callImportName: '__RPC__',
//     callImportFileName: '.rpc/call.ts',
//     callImportUrl: import.meta.resolve('./rpc/call.ts')
// });