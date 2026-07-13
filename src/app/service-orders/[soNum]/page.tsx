"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DetailedServiceOrder } from "@/types/service-order";
import { Loader2 } from "lucide-react";

const DetailModal = dynamic(() => import("@/components/modals/DetailModal"), { ssr: false });

export default function ServiceOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const soNum = params?.soNum as string;

    const [order, setOrder] = useState<DetailedServiceOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!soNum) return;
        async function fetchOrder() {
            try {
                const res = await fetch(`/api/service-orders/core-data/${soNum}?_t=${Date.now()}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache'
                    }
                });
                const json = await res.json();
                if (json.success) {
                    setOrder(json.data);
                }
            } catch (err) {
                console.error("Failed to fetch service order:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchOrder();
    }, [soNum]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm font-medium text-slate-500">Loading Order Details...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4">
                <p className="text-lg font-bold text-slate-800">Order {soNum} not found</p>
                <button 
                    onClick={() => router.push('/service-orders/pat')}
                    className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition"
                >
                    Back to PAT Orders
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
            <DetailModal 
                isOpen={true} 
                onClose={() => router.push('/service-orders/pat')} 
                selectedOrder={order} 
            />
        </div>
    );
}
