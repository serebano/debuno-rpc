import {
    ServerSentEvent,
    ServerSentEventStreamTarget,
} from "https://deno.land/std@0.204.0/http/server_sent_event.ts";
import type { SSE, SSETarget } from "./types.ts";

const console = globalThis.console.extend('sse')

export function createSSE(opts?: {
    keepAlive?: number | boolean,
    space?: string | number,
    onTargetCreated?: (target: SSETarget) => void
}): SSE {

    opts = opts || {}
    const targets = new Set<SSETarget>()
    let eventId = 1

    const send = (data: any) => emit('message', data)

    function emit(event: string, data: any) {
        const id = eventId++
        if (typeof data === 'object')
            data.timestamp = Date.now()
        const sse = new ServerSentEvent(event, { id, data, space: opts?.space })

        console.debug(`emit(${event})`, id, data)

        for (const target of targets) {
            target.dispatchEvent(sse)
        }
    }

    function comment(comment: any) {
        for (const target of targets) {
            target.dispatchComment(comment)
        }
    }

    async function close() {
        for (const target of targets) {
            await target.close()
        }
    }

    async function createTarget() {
        const target = new ServerSentEventStreamTarget({ keepAlive: opts?.keepAlive }) as SSETarget

        target.id = targets.size + 1
        target.emit = (event, data) => target.dispatchEvent(new ServerSentEvent(event, { id: eventId++, data, space: opts?.space }))
        target.comment = (comment: string) => target.dispatchComment(comment)

        target.addEventListener('close', e => {
            const target = e.target as SSETarget
            targets.delete(target)
            comment(`target #${target.id} closed (${targets.size})`)

            console.debug(`[close]`, target.id)
        })

        target.comment(`welcome #${target.id}`)
        comment(`target #${target.id} joined (${targets.size + 1})`)
        targets.add(target)

        console.debug(`[open]`, target.id)

        await opts?.onTargetCreated?.(target)

        return target
    }

    return {
        targets,
        eventId,
        close,
        emit,
        send,
        comment,
        createTarget
    }
}