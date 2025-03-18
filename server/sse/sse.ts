import { createSSE } from "./createSSE.ts";


export const sse = createSSE({
    space: 2,
    keepAlive: true
});
