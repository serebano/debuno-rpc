export interface Route {
    name?: string
    match(request: Request, url: URL): Promise<boolean> | boolean;
    fetch(request: Request, url: URL): Promise<Response | void> | Response | void;
}

export interface Router {
    routes: Route[]
    hooks?: Hooks
    match(request: Request): Promise<Route[]>
    fetch(request: Request): Promise<Response> | Response
    request(input: Request | URL | string, init?: RequestInit): Promise<Response> | Response
}

export interface ErrorResponseObject {
    error: {
        message: string;
        stack: string[];
        code?: string;
        path?: string;
    };
    status: number;
}

export interface Hooks {
    onRequest?: (request: Request) => Promise<Request> | Request
    onResponse?: (request: Request, response: Response) => Promise<Response> | Response
    onError?: (request: Request, error: ErrorResponseObject) => Promise<Response> | Response
}