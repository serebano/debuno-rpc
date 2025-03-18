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