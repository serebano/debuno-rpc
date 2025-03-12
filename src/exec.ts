/**
 * Executes a function from a dynamically imported module based on the request data.
 *
 * @param request - The incoming request object.
 * @param resolve - A function that resolves the request to a module path.
 * @returns A promise that resolves to a Response object containing the result of the function execution.
 */
export async function exec(request: Request, filePath: string, fileVersion?: Record<string, number | undefined> | undefined): Promise<Response> {
    try {
        filePath = filePath.startsWith('file') ? filePath : 'file://' + filePath
        const { path, args } = await request.json() as { path: string; args: any[]; };
        if (fileVersion) {
            const ver = fileVersion[filePath]
            if (ver) {
                filePath = filePath + "?ver=" + ver
            }
        }

        const arrPath = path.split('.');
        const name = arrPath.pop() as string;

        console.log(`exec(${filePath}, ${path})`, args);

        const module = await import(filePath);
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
                }
            })
            : result instanceof Response ? result : Response.json(result);

    } catch (error: any) {
        console.error(error);

        return new Response(error.message, {
            status: 500,
            statusText: 'Internal Server Error'
        });
    }
}
