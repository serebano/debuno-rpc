import type { ServerSentEventStreamTarget } from "./ServerSentEvent.ts";

export interface Endpoint {
    $oid: string;
    file: string;
    http: string;
    base: string;
    endpoint: string;
    status: number;
    checks: number;
    failed: number;
}

export interface SyncEndpointsResult {
    allEndpoints: Endpoint[];
    newEndpoints: Endpoint[];
    validEndpoints: Endpoint[];
    failedEndpoints: Endpoint[];
    allIds: string[];
    newIds: string[];
    validIds: string[];
    changes: {
        added: string[];
        removed: string[];
    };
};

export type SSETarget = ServerSentEventStreamTarget & {
    id: number;
    emit(event: string, data: any): boolean;
    comment(comment: string): boolean
}

export interface SSE {
    targets: Set<SSETarget>;
    eventId: number;
    createTarget(): Promise<SSETarget>
    comment(comment: any): void;
    emit(event: string, data?: any): void;
    send(data: any): void;
    close(): Promise<void>
}

export interface File {
    lang?: string;
    base: string;
    path: string;
    file: string;
    http: string;
    version: number | null;
    endpoint: string;
    dirname: string;
    dependents: Record<string, number | null> | null;
    dependencies: Record<string, number | null> | null
}

export interface FileEvent extends File {
    type: "added" | "changed" | "removed";
    version: number;
    timestamp: number;
}