/**
 * UPI - Universal Programming Interface
 * 
 * @description  This module provides a framework for handling API requests and responses in a dynamic and flexible manner.
 *               It includes interfaces for defining API requests and responses, utility functions for error handling,
 *               and a mechanism for creating API proxies that can dynamically invoke methods on a remote target.
 * 
 * @module upi
 * 
 * @example
 * ```typescript
 * import upi from '@serebano/upi';
 * 
 * const api = upi('http://example.com/api');
 * const result = await api.someMethod('arg1', 'arg2');
 * ```
 * 
 * @example
 * ```typescript
 * import upi from '@serebano/upi';
 * 
 * const api = upi('file://./myModule.ts');
 * const result = await api.someMethod('arg1', 'arg2');
 * ```
 */

export const UPI_ID_HEADER = 'X-UPI-ID';
export const UPI_USER_AGENT = 'UPI/1.0';

export default upi;

/**
 * Creates a proxy for a given URL input based on its protocol.
 * 
 * @param {string | URL} input - The input URL or string to create a proxy for.
 * @returns A proxy object with handlers based on the URL protocol.
 * 
 * @throws {Error} - Throws an error if the protocol is unsupported.
 * 
 * Supported protocols:
 * - 'http:'
 * - 'https:'
 * - 'file:'
 */

export function upi<T extends UPITarget>(input: string | URL): T {
    const url = new URL(input)

    switch (url.protocol) {
        case 'http:':
        case 'https:':
            return proxy<T>(Object.create(null), createFetchHandler(url))

        case 'file:':
            return proxy<T>(Object.create(null), createLocalHandler(url))

        default:
            throw new Error(`Unsupported protocol: ${url.protocol}`)
    }
}

/**
 * Creates a local handler function that dynamically imports a module based on the provided input
 * and processes a request using the imported module.
 *
 * @param input - A string or URL that specifies the path to the module to be imported.
 * @returns A function that takes a context and a request, imports the specified module,
 *          and handles the request using the imported module.
 */
export function createLocalHandler(input: string | URL): UPIHandler {
    return async function localHandler(_, request) {
        const url = import.meta.resolve(String(input))
        const mod = await import(url)
        const res = await handle(mod, request)

        return res
    }
}


/**
 * Creates a fetch handler function that sends a POST request to the specified input URL.
 *
 * @param input - The URL or string to which the POST request will be sent.
 * @returns A function that handles the fetch request and returns the JSON response.
 *
 * @throws Will throw an error if the fetch request fails or if the response contains an invalid UPI ID header.
 */
export function createFetchHandler(input: string | URL): UPIHandler {
    return async function fetchHandler(_, request) {
        const response = await fetch(input, {
            method: 'POST',
            headers: {
                'User-Agent': UPI_USER_AGENT,
                'Content-Type': 'application/json',
                [UPI_ID_HEADER]: request.id,
            },
            body: JSON.stringify({
                path: request.path,
                args: request.args,
            })
        })

        if (!response.ok)
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);

        if (response.headers.get(UPI_ID_HEADER) !== request.id)
            throw new Error(`Invalid response: ${response.status}} { req=${request.id}, res=${response.headers.get(UPI_ID_HEADER)} }`);

        return await response.json()
    }
}

/**
 * Creates an API proxy for the given target and handler.
 *
 * @template T - The type of the API target.
 * @param {T} target - The API target object to be proxied.
 * @param {UPIHandler} handler - The handler function that processes API requests.
 * @returns {T} - A proxied version of the target object.
 *
 * @throws {UndefinedNotAllowedError} - If any of the arguments passed to the proxied function are `undefined`.
 *
 * @example
 * ```typescript
 * const api = createAPI(myTarget, myHandler);
 * const result = await api.someMethod('arg1', 'arg2');
 * ```
 */
export function proxy<T extends UPITarget>(target: T, handler: UPIHandler): T {

    function createProxyHandler(path: string[]): ProxyHandler<any> {
        const proxyHandler: ProxyHandler<any> = {
            apply: (target, thisArg, argArray) => Reflect.apply(target, thisArg, argArray),
            get(_, prop: string) {
                path = [...path, prop];
                return new Proxy(async (...args: any[]): Promise<any> => {
                    if (args.includes(undefined))
                        throw new UndefinedNotAllowedError(`${prop}: undefined not allowed, use null instead`);

                    const req: UPIRequest = { id: uid(), path, args };
                    const res: UPIResponse = await handler(target, req);

                    if (res.error)
                        throw stringToError(res.error);

                    return res.result;
                }, createProxyHandler(path));
            }
            // TODO: Add support for setting properties on the target object.
        };

        return proxyHandler;
    }

    return new Proxy(target, createProxyHandler([])) as T;
}

/**
 * Handles API requests by dynamically invoking the specified method on the target object.
 *
 * @param target - The target object on which the method is to be invoked.
 * @param request - The API request containing the path to the method and the arguments to be passed.
 * @returns A promise that resolves to an API response containing either the result of the method invocation or an error message.
 *
 * @throws Will return an error response if the specified method is not found on the target object.
 */
export async function handle(target: UPITarget, request: UPIRequest): Promise<UPIResponse> {
    const path = [...request.path || []];
    const prop = path.pop();
    const func = (prop
        ? (target = get(target, path))[prop]
        : undefined) as undefined | ((...args: any[]) => any)

    if (func === undefined) {
        return {
            id: request.id,
            path: request.path,
            error: errorToString(new Error(`Unknown request "${path.join('.')}:${prop}". \nValid = ${Object.keys(target)}`)),
        };
    }

    try {
        return {
            id: request.id,
            path: request.path,
            result: await func.apply(target, request.args),
        }
    } catch (error: any) {
        return {
            id: request.id,
            path: request.path,
            error: errorToString(error),
        };
    }
}



/** 
 * ----------------------------------------------------------------------------
 * UPI Serve
 * ----------------------------------------------------------------------------
 */

export type ServeModule<T = any> = {
    ENV: ENV
    Server: T
    serve: (options: ServeOptions) => Promise<T>
    readDir: (path: string) => Promise<string[]>
    readFile: (filePath: string) => Promise<BodyInit> | BodyInit
    writeFile: (filePath: string, data: any) => Promise<void>
}

export type ServeOptions = {
    path: string
    port: number,
    hostname?: string,
    onListen?: (addr: { port: number, hostname: string }) => void,
    onError?: (error: Error) => void
}

export type HandlerContext = {
    path: string,
    readFile: (path: string) => Promise<BodyInit> | BodyInit,
    readDir: (path: string) => Promise<string[]>
}

export function createRequestHandler(ctx: HandlerContext): (request: Request) => Promise<Response> {

    return async function requestHandler(request: Request) {

        const url = new URL(request.url)
        const modPath = [ctx.path, url.pathname].join('')
        const resolvedModPath = import.meta.resolve(modPath)
        const userAgent = request.headers.get('User-Agent')
        const isUPIAgent = userAgent?.startsWith(UPI_USER_AGENT)

        if (url.pathname === '/favicon.ico') {
            return new Response(null, { status: 204 })
        }

        if (request.method === 'GET' && url.pathname.startsWith('/upi')) {

            const basePath = resolvePath('dist', import.meta.dirname)
            // const filePath = (basePath + url.pathname.slice(4)).replace('/dist/dist', '/dist').replace('/src/src', '/src')
            let filePath = ''

            if (url.pathname === '/upi' || url.pathname === '/upi.js') {
                filePath = import.meta.resolve('../dist/mod.js') //resolvePath('dist/mod.js', import.meta.dirname)
            }

            if (url.pathname === '/upi.d.ts') {
                filePath = import.meta.resolve('../dist/mod.d.ts') //resolvePath('dist/mod.js', import.meta.dirname)
            }

            if (url.pathname === '/upi.ts') {
                filePath = import.meta.url //resolvePath('dist/mod.js', import.meta.dirname)
            }

            const dtsFile = url.pathname.endsWith('.ts') ? '' : url.pathname.replace('.js', '') + '.d.ts'

            try {
                return new Response(await ctx.readFile(filePath), {
                    status: 200,
                    headers: {
                        'Content-Type': url.pathname.endsWith('.ts') ? 'application/typescript' : 'application/javascript',
                        'X-Typescript-Types': dtsFile
                    }
                })
            } catch (error: any) {
                return new Response(error.message, { status: 404 })
            }

        }

        console.log(`[${request.method}]`, {
            http: request.url,
            file: resolvedModPath,
            isUPIAgent
        })

        if (request.method === 'POST') {
            const req = await request.json() as UPIRequest
            const mod = await import(modPath)
            const res = await handle(mod, req)
            console.log('(POST)', { req, mod, res })
            return Response.json(res, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    [UPI_ID_HEADER]: request.headers.get(UPI_ID_HEADER) || ''
                }
            })
        }

        if (request.method === 'GET') {
            if (url.pathname.endsWith('/')) {
                const files = (await ctx.readDir(modPath)).map(file => url + file)

                return Response.json({ modPath, files })
            }

            try {
                const _modPath = url.pathname.endsWith('.d.ts') ? modPath.replace('.d.ts', '.ts') : modPath
                const module = url.pathname.endsWith('.d.ts')
                    ? await ctx.readFile(_modPath)
                    : modTemplate(url, await import(_modPath))

                return new Response(module, {
                    status: 200,
                    headers: {
                        'Content-Type': url.pathname.endsWith('.ts') ? 'application/typescript' : 'application/javascript',
                        [UPI_ID_HEADER]: request.headers.get(UPI_ID_HEADER) || '',
                        'x-typescript-types': url.pathname.endsWith('.ts')
                            ? ''
                            : url.pathname.replace('.js', '').replace('.mjs', '') + '.d.ts'
                    }
                })
            } catch (error: any) {
                return Response.json({ error: error.message, modPath }, { status: 500 })
            }
        }

        return Response.json({ error: 'Method not allowed' }, { status: 405 })
    }
}


export function modTemplate(url: string | URL, mod: any): string {
    url = new URL(url)
    const modUrl = `.${url.pathname.replace('.ts', '.mod.ts')}`
    const keys = Object.keys(mod).filter(key => key !== 'default')
    const types = url.pathname.endsWith('.ts') ? `as typeof import('${url.href.replace('.ts', '.d.ts')}')` : ''
    let libUrl = new URL(url)
    libUrl.pathname = '/upi'
    const importUPI = libUrl.href //['browser', 'deno'].includes(getEnv()) ? '/upi' : '/upi' //xxw?v=' + Date.now()

    const template = `
        // ${getEnv()} ${url.pathname}
        import upi from "${importUPI}";

        const mod = upi('${url}') ${types}

        export const { ${keys.join(', ')} } = mod
        export default ${mod.default ? 'mod.default' : `mod`}`;

    return template.split('\n').map(line => line.trim()).join('\n')
}


/**
 * UPI Utils
 */


/**
 * Resolves a given path-like string or URL against a base URL or the current working directory.
 *
 * @param pathLike - The path-like string or URL to resolve.
 * @param base - An optional base URL or string to resolve against. If not provided, the current working directory or global location is used.
 * @returns The resolved URL as a string.
 */
export const resolveURL = (pathLike: string | URL, base?: string | URL): string => String(new URL(pathLike, base || get(globalThis, 'process.cwd')
    ? new URL(get(globalThis, 'process.cwd')?.() + '/', 'file://')
    : get(globalThis, 'location')))

export const resolvePath = (pathLike: string, base?: string): string => resolveURL(pathLike, base).replace('file://', '')

export type EnvType = 'browser' | 'node' | 'deno' | 'bun' | 'unknown'
export type ServeEnvType = 'node' | 'deno' | 'bun'

type Global = typeof globalThis & Record<string, undefined>

export type ENV = Global['Bun'] extends undefined
    ? Global['Deno'] extends undefined
    ? Global['process'] extends undefined
    ? Global['window'] extends undefined ? 'unknown' : 'browser'
    : 'node'
    : 'deno'
    : 'bun'

export const IS_BROWSER: boolean = 'window' in globalThis
export const IS_DENO: boolean = 'Deno' in globalThis
export const IS_BUN: boolean = "Bun" in globalThis
// @ts-ignore
export const IS_NODE: boolean = !IS_BUN && !IS_DENO && ('process' in globalThis) && !!get(globalThis, 'process.versions.node')

export const ENV = getEnv() as ENV

export function getEnv(): EnvType {
    if (IS_BROWSER) return 'browser'
    if (IS_NODE) return 'node'
    if (IS_DENO) return 'deno'
    if (IS_BUN) return 'bun'
    return 'unknown'
}

export function getDetails(target: any): { ownKeys: (string | symbol)[]; getPrototypeOf: object | null; getOwnPropertyDescriptors: any; } {
    return {
        ownKeys: Reflect.ownKeys(target),
        getPrototypeOf: Reflect.getPrototypeOf(target),
        getOwnPropertyDescriptors: Reflect.ownKeys(target).reduce((acc: any, key: any) => {
            acc[key] = Reflect.getOwnPropertyDescriptor(target, key);
            return acc;
        }, Object.create(null)),
    }
}

/**
 * Represents an error where `undefined` is not allowed.
 */
export class UndefinedNotAllowedError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'UndefinedNotAllowed';
    }
}

export const ERROR_CLASSES: any[] = [
    EvalError,
    RangeError,
    ReferenceError,
    SyntaxError,
    TypeError,
    URIError,
];

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo));
export const uid = (): string => ('' + randInt(0, 999999999999999)).padStart(15, '0');

export function get(obj: any, path: string | string[]): any {
    return (Array.isArray(path) ? path : path.split('.'))
        .reduce((currentObject, key) => currentObject ? currentObject[key] : undefined, obj);
}

/**
 * Converts an error to a string representation.
 *
 * @param error - The error to be converted.
 * @returns The string representation of the error.
 */
export function errorToString(error: Error): string {
    if (error.message) {
        return `${error.name}: ${error.message}\n${error.stack}`;
    } else {
        return error.name;
    }
}

/**
 * Converts a string representation of an error to an Error object.
 *
 * @param s - The string representation of the error.
 * @returns The Error object.
 */
export function stringToError(s: string): Error {
    let [nameMessage, ...stack] = s.split('\n');
    let [name, message] = nameMessage.split(': ');
    let error = new Error();
    let matched = false;
    for (let errorClass of ERROR_CLASSES) {
        if (errorClass.name === name) {
            matched = true;
            error = new errorClass();
            break;
        }
    }

    error.name = name;

    if (message) {
        error.message = message;
    }

    if (stack.length) {
        error.stack = stack.join('\n');
    }

    return error;
}


/**
 * ----------------------------------------------------------------------------
 * UPI Types
 */

/**
 * Represents an API request.
 * 
 * @interface UPIRequest
 * @property {string} id - The unique identifier for the API request.
 * @property {string[]} path - The path segments of the API endpoint.
 * @property {any[]} args - The arguments to be passed with the API request.
 */
export interface UPIRequest {
    id: string
    path: string[]
    args: any[]
}

/**
 * Represents the response from an API call.
 * 
 * @interface UPIResponse
 * @property {string} id - The unique identifier for the API response.
 * @property {string[]} path - The path segments of the API endpoint.
 * @property {any} [result] - The result of the API call, if successful.
 * @property {string} [error] - The error message, if the API call failed.
 */
export interface UPIResponse {
    id: string
    path: string[]
    result?: any
    error?: string
}

/**
 * Represents a target for an API call.
 * 
 * @property {string} key - The key representing the target.
 * @property {any} value - The value associated with the key.
 */
export type UPITarget = Record<string, any>;

/**
 * Represents a handler function for API requests.
 *
 * @param target - The target of the API request.
 * @param request - The API request object.
 * @returns A promise that resolves to an API response.
 */
export type UPIHandler = (target: UPITarget, request: UPIRequest) => Promise<UPIResponse>;