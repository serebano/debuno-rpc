export type RPCFunction = <T>(path: string, ...args: any[]) => Promise<T>

export type RPCContext = RPCFunction & {
    call<T>(url: string, path: string, ...args: any[]): Promise<T>
    apply<T>(url: string, path: string, args: any[]): Promise<T>
}