import pkg from '../package.json' with {type: "json"}
import process from "node:process";
import type { Env } from "../types/env.ts";

export function createEnv(): Env {
    const env: Env = {
        version: [
            [pkg.displayName, pkg.version].join('/'),
            navigator.userAgent
        ],
        get(key?: string): string | NodeJS.ProcessEnv | undefined {
            return key ? process.env[key.toUpperCase()] : process.env
        },
        set(key: string, value: any) {
            process.env[key.toUpperCase()] = value
        }
    }
    env.version.toString = () => env.version[0] + ` (${env.version[1]})`
    return env
}