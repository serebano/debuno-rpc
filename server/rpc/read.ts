import { getContentType } from "./utils.ts";

export async function read({ filePath, fileType, transform, url, request }: {
    url: string,
    request: Request,
    filePath: string,
    fileType?: 'javascript' | 'typescript' | 'json',
    transform?: (sourceCode: string, filePath: string, url: string, req: Request) => string | Response | Promise<string | Response>
}): Promise<Response> {
    filePath = filePath.startsWith('file') ? filePath : 'file://' + filePath
    const isScript = (filePath.endsWith('.ts') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('jsx'))

    fileType = isScript && fileType ? `application/${fileType}` : (getContentType(filePath) as any);

    console.log(`read(${filePath}, ${fileType})`);

    const result = await (await import('node:fs/promises')).readFile(filePath.replace('file://', ''), 'utf-8')
    const response = transform ? await transform(result, filePath, url, request) : result

    return (response instanceof Response) === false
        ? new Response(response, {
            headers: {
                "content-type": fileType!,
                "x-file-path": filePath
            }
        }) : response

}