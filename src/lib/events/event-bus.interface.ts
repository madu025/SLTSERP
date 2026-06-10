export interface EventBus {
    publish(channel: string, data: unknown): Promise<void>;
    subscribe(channel: string, callback: (data: any) => void): () => void;
}
