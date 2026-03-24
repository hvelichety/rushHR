declare module 'react-native-event-source' {
    export default class EventSource {
      constructor(url: string, eventSourceInitDict?: any);
      addEventListener(
        type: string,
        listener: (event: { data: string }) => void
      ): void;
      removeEventListener(type: string, listener: any): void;
      close(): void;
      url: string;
      readyState: number;
      withCredentials: boolean;
      CONNECTING: number;
      OPEN: number;
      CLOSED: number;
      onopen?: (event: any) => void;
      onmessage?: (event: { data: string }) => void;
      onerror?: (event: any) => void;
    }
  }
  