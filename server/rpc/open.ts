import { execFile } from "node:child_process";

export function openWithRedirect(filePath: string, line?: number, column?: number): Response {
    const openPath = [filePath, line, column].filter(Boolean).join(':')
    const openUri = `vscode://file${openPath}`

    return Response.redirect(openUri)
}

export function open(filePath: string, line?: number, column?: number): Promise<Response> {
    const openPath = [filePath, line, column].filter(Boolean).join(':')
    const openUri = `vscode://file${openPath}`

    console.log(`open(${openUri})`)

    return new Promise<Response>((resolve, reject) => {
        execFile('open', [openUri], (error, _stdout, _stderr) => {
            if (error)
                reject(error)
            else
                resolve(new Response(null, {
                    headers: {
                        'x-file-path': filePath,
                        'x-file-line': String(line || 1),
                        'x-file-column': String(column || 1)
                    }
                }))
        });
    })
}