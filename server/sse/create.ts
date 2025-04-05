import {
    ServerSentEvent,
    ServerSentEventStreamTarget,
} from "https://deno.land/std@0.204.0/http/server_sent_event.ts";
import type { SSE, SSETarget } from "./types.ts";
import { createConsole, type ConsoleLevel } from "../../utils/console.ts";

export function createSSE(opts?: {
    keepAlive?: number | boolean,
    space?: string | number,
    consoleName?: string,
    consoleLevels?: ConsoleLevel[],
}): SSE {

    opts = opts || {}
    const targets = new Set<SSETarget>()
    let eventId = 1

    const console = createConsole(opts?.consoleName || '[sse]', {
        levels: opts?.consoleLevels,
    })

    const send = (data: any) => emit('message', data)

    function emit(event: string, data: any) {
        const id = eventId++
        const sse = new ServerSentEvent(event, { id, data, space: opts?.space })

        console.log(`emit(${event})`, id, data)

        for (const target of targets) {
            target.dispatchEvent(sse)
        }
    }

    function comment(comment: any) {
        for (const target of targets) {
            target.dispatchComment(comment)
        }
    }

    function createTarget() {
        const target = new ServerSentEventStreamTarget({ keepAlive: opts?.keepAlive }) as SSETarget

        target.id = targets.size + 1
        target.emit = (event, data) => target.dispatchEvent(new ServerSentEvent(event, { id: eventId++, data, space: opts?.space }))
        target.comment = (comment: string) => target.dispatchComment(comment)

        target.addEventListener('close', e => {
            const target = e.target as SSETarget
            targets.delete(target)
            comment(`target #${target.id} closed (${targets.size})`)
            console.log(`[sse][close]`, target.id)
        })

        target.comment(`welcome #${target.id}`)
        comment(`target #${target.id} joined (${targets.size + 1})`)
        targets.add(target)
        console.log(`[sse][open]`, target.id)

        return target
    }

    return {
        targets,
        eventId,
        emit,
        send,
        comment,
        createTarget
    }
}