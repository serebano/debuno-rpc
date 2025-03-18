export interface Route {
    match(request: Request, url: URL): Promise<boolean> | boolean;
    fetch(request: Request, url: URL): Promise<Response | void> | Response | void;
}

export interface Router {
    match(request: Request): Promise<Route[]>
    fetch(request: Request): Promise<Response> | Response
}