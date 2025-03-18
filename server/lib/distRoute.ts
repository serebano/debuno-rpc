import { readFile } from "node:fs/promises";
import { getFileExtension, getContentType } from "../../utils/mod.ts";
import { createRoute } from "../../utils/router.ts";
import { b } from "../../example/x.ts";

export default createRoute((config) => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname.startsWith(config.client.base),
    async fetch(request) {
        const url = new URL(request.url);
        url.pathname = url.pathname.replace(config.client.base, '/').replace('//', '/');
        url.pathname = getFileExtension(url.pathname) ? url.pathname : `${url.pathname}.js`;

        const IMPORT_META_ENV = `import.meta.env = (await import('${config.client.envImportUrl}')).create(import.meta);\n`

        const filePath = config.client.path + url.pathname;
        const source = await readFile(filePath)
        const body = source.includes('import.meta.env')
            ? IMPORT_META_ENV + source
            : source

        return new Response(body, {
            headers: {
                'x-file-path': filePath,
                'content-type': getContentType(url.pathname)
            }
        });
    }
}));
