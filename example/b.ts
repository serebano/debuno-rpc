export function stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(controller) {
            controller.enqueue('Hello');
            controller.enqueue(' ');
            controller.enqueue('World!!');
            controller.close();
        }
    }).pipeThrough(new TextEncoderStream)
}