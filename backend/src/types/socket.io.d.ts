declare module 'socket.io' {
  export class Server {
    constructor(httpServer: any, options?: any);
    use(fn: (socket: any, next: any) => void): this;
    on(event: string, listener: (socket: any) => void): this;
    to(room: string): { emit: (event: string, data: any) => void };
    emit(event: string, data: any): void;
  }
  export type Socket = any;
}
