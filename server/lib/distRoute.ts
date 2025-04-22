import { readFile } from "node:fs/promises";
import { getFileExtension, getContentType } from "../../utils/mod.ts";
import { createRoute } from "../../utils/router.ts";

export default createRoute((app) => ({
    match: (request) => request.method === 'GET' && new URL(request.url).pathname.startsWith(app.config.client.base),
    async fetch(request) {
        const url = new URL(request.url);
        url.pathname = url.pathname.replace(app.config.client.base, '/').replace('//', '/');
        url.pathname = getFileExtension(url.pathname) ? url.pathname : `${url.pathname}.js`;

        const IMPORT_META_ENV = `import.meta.env = (await import('${app.config.client.envImportUrl}')).create(import.meta);\n`

        const filePath = app.config.client.path + url.pathname;
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
