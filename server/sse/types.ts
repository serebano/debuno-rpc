import type { ServerSentEventStreamTarget } from "https://deno.land/std@0.204.0/http/server_sent_event.ts";

export type SSETarget = ServerSentEventStreamTarget & {
    id: number;
    emit(event: string, data: any): boolean;
    comment(comment: string): boolean
}

export interface SSE {
    targets: Set<SSETarget>;
    eventId: number;
    createTarget(): SSETarget
    comment(comment: any): void;
    emit(event: string, data: any): void;
    send(data: any): void;
}

export interface File {
    path: string;
    file: string;
    http: string;
    version: number | null;
    dependents: Record<string, number | null> | null;
    dependencies: Record<string, number | null> | null
}

export interface FileEvent extends File {
    type: "added" | "changed" | "removed";
    version: number;
    timestamp: number;
}