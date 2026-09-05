/**
 * Typed event payload map.
 * Each key is a channel name; the value is the payload shape
 * that publishers MUST send and subscribers WILL receive.
 *
 * Dynamic channels (e.g. `new-notification:{userId}`) use a
 * fallback `Record<string, unknown>` shape because the channel
 * name varies at runtime.
 */
import type { SyncActor } from '@/lib/constants/sod-status-policy';

export interface EventMap {
    'inventory.stock_request_created': {
        request: {
            id: string;
            requestNr: string;
            fromStoreName: string;
            opmcId?: string;
            type?: string;
        };
        stage: string;
    };
    'inventory.stock_request_stage_changed': {
        request: { id: string; requestNr: string };
        stage: string;
        roles: string[];
    };
    'inventory.stock_request_finalized': {
        request: { id: string; requestNr: string; requestedById: string };
        action: string;
        remarks?: string;
    };
    'inventory.low_stock_detected': {
        store: string;
        item: string;
        currentStock: number;
        minStock: number;
    };
    'contractor.registered': {
        contractor: {
            id: string;
            name: string;
            siteOfficeStaffId?: string | null;
            opmcId?: string | null;
        };
        siteOfficeStaffId?: string | null;
    };
    'contractor.status_changed': {
        contractor: Record<string, unknown>;
        status: string;
        rejectionReason?: string;
    };
    'sod.status_changed': {
        serviceOrderId: string;
        soNum: string;
        opmcId?: string | null;
        /** Both status fields here are the portal-mirror `sltsStatus` dimension. */
        oldStatus: string;
        newStatus: string;
        returnReason?: string | null;
        userId: string;
        /**
         * Which writer moved it. Listeners need this to distinguish a live feed re-assertion
         * (PORTAL_SWEEP replaying a closed row) from a real business transition, which is exactly
         * what the completion-notification flood (O2) was built on.
         */
        actor?: SyncActor;
    };
    'system-event': {
        type: string;
        [key: string]: unknown;
    };
}

/**
 * Channels that do NOT match a known EventMap key fall back to this shape.
 * This covers dynamic per-user channels like `new-notification:{userId}`.
 */
export type FallbackPayload = Record<string, unknown>;

export interface EventBus {
    publish<K extends keyof EventMap>(channel: K, data: EventMap[K]): Promise<void>;
    publish(channel: string, data: FallbackPayload): Promise<void>;

    subscribe<K extends keyof EventMap>(
        channel: K,
        callback: (data: EventMap[K]) => void
    ): () => void;
    subscribe(
        channel: string,
        callback: (data: FallbackPayload) => void
    ): () => void;
}
