declare module "event-source-polyfill" {
    export class EventSourcePolyfill {
      constructor(url: string, options?: any);
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: ((event: any) => void) | null;
      close(): void;
      addEventListener(
        type: string,
        listener: (event: MessageEvent) => void
      ): void;
    }
  }  