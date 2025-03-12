/**
 * Calls a remote procedure by sending a POST request with the function name and arguments.
 *
 * @param url - The URL of the remote procedure.
 * @param path - The name of the function to call.
 * @param args - The arguments to pass to the function.
 * @returns A promise that resolves to the result of the remote procedure call.
 */
async function call<T>(url: string, path: string, ...args: any[]): Promise<T> {
    console.log(`${path}@${url}`, args);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, args }),
    });

    const contentType = res.headers.get('content-type') ?? 'text/plain';

    if (!res.ok) {
        throw new Error(`${await res.text()}`);
    }

    return contentType.startsWith('text/') && !contentType.endsWith('stream')
        ? await res.text()
        : contentType === 'application/json'
            ? await res.json()
            : res.body;
}

export default call