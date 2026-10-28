"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, PackageCheck, ShoppingCart, Truck } from "lucide-react";

type Availability = {
  storeId: string;
  storeName: string;
  storeType: string;
  onHand: number;
  reserved: number;
  safetyStock: number;
  availableToPromise: number;
};

type Demand = {
  id: string;
  project: { id: string; projectCode: string; name: string; status: string; opmc?: { name: string; rtom: string } | null };
  task?: { name: string; wbsCode?: string | null } | null;
  contractor?: { name: string } | null;
  item?: { code: string; name: string; unit: string } | null;
  requiredQty: number;
  reservedQty: number;
  issuedQty: number;
  shortageQty: number;
  status: string;
  procurementStatus: string;
  availability: Availability[];
  allocations: { sourceType: string; status: string; requestedQty: number; receivedQty: number; request?: { requestNr: string; issueNoteNumber?: string | null } | null }[];
};

function apiData<T>(payload: T | { data?: T }): T {
  if (payload && typeof payload === "object" && "data" in payload && (payload as { data?: T }).data !== undefined) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export default function ProjectMaterialControlPage() {
  const [rows, setRows] = useState<Demand[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/project-material-demands?_t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load project material demand");
      setRows(apiData<Demand[]>(await response.json()) || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load material demand");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const action = async (body: Record<string, unknown>, key: string) => {
    setWorking(key);
    try {
      const response = await fetch("/api/inventory/project-material-demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) throw new Error(payload?.error?.message || payload?.error || "Action failed");
      toast.success("Material control action completed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="erp-page-wrapper flex-row overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-slate-50">
        <Header />
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-cyan-700">Inventory / Stores</p>
              <h1 className="text-2xl font-bold text-slate-900">Project Material Control</h1>
              <p className="mt-1 text-sm text-slate-700">Approved BOQ demand, store ATP, reservations, SLT requests and local purchase requests.</p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-slate-300 bg-white text-slate-800">
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-900">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Project / Task</th>
                    <th className="px-4 py-3 font-semibold">Material</th>
                    <th className="px-4 py-3 font-semibold">Demand</th>
                    <th className="px-4 py-3 font-semibold">Store ATP</th>
                    <th className="px-4 py-3 font-semibold">Supply requests</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-700">Loading material demand…</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-700">No approved project material requirements found.</td></tr>}
                  {rows.map((row) => {
                    const store = row.availability[0];
                    const key = row.id;
                    return (
                      <tr key={row.id} className="align-top hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{row.project.projectCode}</div>
                          <div className="text-slate-700">{row.project.name}</div>
                          <div className="mt-1 text-xs text-slate-600">{row.task?.wbsCode ? `${row.task.wbsCode} · ` : ""}{row.task?.name || "Unassigned task"}</div>
                          {row.contractor && <div className="text-xs text-slate-600">Contractor: {row.contractor.name}</div>}
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-medium text-slate-900">{row.item?.name || "Material mapping required"}</div>
                          <div className="text-xs text-slate-600">{row.item?.code || "—"} · {row.item?.unit || "—"}</div>
                        </td>
                        <td className="px-4 py-4 text-slate-800">
                          <div>Required: <b>{row.requiredQty}</b></div>
                          <div>Reserved: {row.reservedQty}</div>
                          <div>Issued: {row.issuedQty}</div>
                          <Badge className="mt-2 bg-amber-100 text-amber-900">{row.status}</Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-800">
                          {store ? <>
                            <div className="font-medium text-slate-900">{store.storeName}</div>
                            <div>ATP: <b>{store.availableToPromise}</b></div>
                            <div className="text-xs text-slate-600">On hand {store.onHand} · Reserved {store.reserved}</div>
                          </> : <span className="text-slate-600">No scoped store stock</span>}
                        </td>
                        <td className="px-4 py-4 text-slate-800">
                          {row.allocations.length === 0 ? <span className="text-slate-600">No source request</span> : row.allocations.map((allocation) => (
                            <div key={`${row.id}-${allocation.sourceType}`} className="mb-2 rounded border border-slate-200 p-2">
                              <div className="font-medium text-slate-900">{allocation.sourceType} · {allocation.status}</div>
                              <div className="text-xs text-slate-600">Requested {allocation.requestedQty} · Received {allocation.receivedQty}</div>
                              {allocation.request?.requestNr && <div className="text-xs text-slate-600">MRN/Request: {allocation.request.requestNr}</div>}
                            </div>
                          ))}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            {store && store.availableToPromise > 0 && <Button size="sm" onClick={() => void action({ action: "RESERVE_AVAILABLE", projectId: row.project.id, storeId: store.storeId, requirementIds: [row.id] }, `${key}-reserve`)} disabled={working !== null} className="bg-emerald-700 text-white hover:bg-emerald-800">
                              <PackageCheck className="mr-1 h-4 w-4" /> Reserve ATP
                            </Button>}
                            {store && <Button size="sm" variant="outline" onClick={() => void action({ action: "CREATE_SOURCE_REQUEST", requirementId: row.id, sourceType: "SLT", storeId: store.storeId }, `${key}-slt`)} disabled={working !== null} className="border-slate-300 bg-white text-slate-800">
                              <Truck className="mr-1 h-4 w-4" /> Request SLT
                            </Button>}
                            {store && <Button size="sm" variant="outline" onClick={() => void action({ action: "CREATE_SOURCE_REQUEST", requirementId: row.id, sourceType: "LOCAL_PURCHASE", storeId: store.storeId }, `${key}-local`)} disabled={working !== null} className="border-slate-300 bg-white text-slate-800">
                              <ShoppingCart className="mr-1 h-4 w-4" /> Local purchase
                            </Button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
