export interface EventBus {
    publish(channel: string, data: unknown): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(channel: string, callback: (data: any) => void): () => void;
}
