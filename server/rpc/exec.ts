import type { App } from "../index.ts";

/**
 * Executes a function from a dynamically imported module based on the request data.
 *
 * @param request - The incoming request object.
 * @param resolve - A function that resolves the request to a module path.
 * @returns A promise that resolves to a Response object containing the result of the function execution.
 */
export async function exec(request: Request, filePath: string, app: App): Promise<Response> {
    try {
        const fileUrl = new URL(filePath.startsWith('file') ? filePath : 'file://' + filePath)
        fileUrl.searchParams.set('endpoint', app.endpoint)
        const { path, args } = await request.json() as { path: string; args: any[]; };

        const version = new URL(request.url).searchParams.get('version')
        if (version) {
            fileUrl.searchParams.set('version', version)
        }

        const arrPath = path.split('.');
        const name = arrPath.pop() as string;

        console.debug(`exec( ${fileUrl} )`);
        console.debug(`  * apply( ${path},`, args, `)`)

        const module = await import(fileUrl.href);
        const target = arrPath.reduce((o, i) => o[i], module);

        const result = typeof target[name] === 'function'
            ? await Reflect.apply(target[name], target, args)
            : args.length === 0
                ? Reflect.get(target, name)
                : Reflect.set(target, name, args[0]);

        return result instanceof ReadableStream
            ? new Response(result, {
                headers: {
                    "content-type": "text/stream",
                    'x-mod-url': fileUrl.href
                }
            })
            : result instanceof Response ? result : Response.json(result, {
                headers: {
                    'x-mod-url': fileUrl.href
                }
            });

    } catch (error: any) {
        console.error(error);

        return new Response(error.message, {
            status: 500,
            statusText: 'Internal Server Error'
        });
    }
}
