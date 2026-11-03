"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ProjectRef = { id: string; name: string; projectCode: string };

type ProjectTaskRow = {
  id: string;
  name: string;
  wbsCode: string;
  status: string;
  priority: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualProgress: number;
  project: ProjectRef;
};

type FieldTaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduledDate: string | null;
  address: string | null;
  project: ProjectRef;
};

type FinanceWorkRow = {
  invoiceId: string;
  invoiceNumber: string;
  title: string | null;
  projectId: string;
  projectName: string;
  totalAmount: number;
  dueDate: string | null;
  status: string;
  action: 'APPROVE' | 'SUBMIT_TO_SLT' | 'FOLLOW_UP';
  actionLabel: string;
};

type MyTasksResponse = { tasks: ProjectTaskRow[]; fieldTasks: FieldTaskRow[]; financeWork: FinanceWorkRow[] };

const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString() : '—');
const label = (value: string) => value.replace(/_/g, ' ');
const isOverdue = (end: string | null) => Boolean(end) && new Date(end as string).getTime() < Date.now();

export default function MyProjectTasksPage() {
  const [data, setData] = useState<MyTasksResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/projects/my-tasks', { signal: controller.signal });
        if (!res.ok) throw new Error(`Could not load your tasks (${res.status}).`);
        const json = (await res.json()) as MyTasksResponse;
        if (!cancelled) setData(json);
      } catch (requestError) {
        if (!cancelled && !controller.signal.aborted) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load your tasks.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [retryToken]);

  const total = (data?.tasks.length ?? 0) + (data?.fieldTasks.length ?? 0) + (data?.financeWork.length ?? 0);

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Header />
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">My Project Tasks</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Open work assigned to you across the projects you can access{data ? ` · ${total} open` : ''}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setRetryToken(n => n + 1)} disabled={loading}>
                Refresh
              </Button>
            </div>

            {loading && (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900" role="status" aria-live="polite">
                Loading your tasks…
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
                {error}
              </div>
            )}

            {data && total === 0 && !loading && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-slate-700">
                No open tasks are assigned to you.
              </div>
            )}

            {data && data.financeWork.length > 0 && (
              <section className="rounded-lg border border-amber-300 bg-white overflow-x-auto">
                <h2 className="px-4 py-3 text-sm font-semibold text-slate-900 border-b border-slate-200">
                  Finance &amp; invoicing - waiting on you
                </h2>
                <table className="w-full text-sm text-slate-800">
                  <thead>
                    <tr className="text-left text-slate-900 border-b border-slate-200">
                      <th className="px-4 py-2 font-semibold">Invoice</th>
                      <th className="px-4 py-2 font-semibold">Project</th>
                      <th className="px-4 py-2 font-semibold">Your action</th>
                      <th className="px-4 py-2 font-semibold text-right">Amount (LKR)</th>
                      <th className="px-4 py-2 font-semibold">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.financeWork.map(item => (
                      <tr key={item.invoiceId} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{item.invoiceNumber}</td>
                        <td className="px-4 py-2">
                          <Link className="text-blue-700 underline" href={`/projects/${item.projectId}`}>
                            {item.projectName}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={item.action === 'FOLLOW_UP' ? 'border-red-300 text-red-800' : 'border-amber-400 text-amber-900'}>
                            {item.actionLabel}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{item.totalAmount.toLocaleString()}</td>
                        <td className={`px-4 py-2 ${isOverdue(item.dueDate) ? 'text-red-700 font-semibold' : ''}`}>
                          {formatDate(item.dueDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data && data.tasks.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                <h2 className="px-4 py-3 text-sm font-semibold text-slate-900 border-b border-slate-200">Project tasks</h2>
                <table className="w-full text-sm text-slate-800">
                  <thead>
                    <tr className="text-left text-slate-900 border-b border-slate-200">
                      <th className="px-4 py-2 font-semibold">WBS</th>
                      <th className="px-4 py-2 font-semibold">Task</th>
                      <th className="px-4 py-2 font-semibold">Project</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Due</th>
                      <th className="px-4 py-2 font-semibold">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tasks.map(task => (
                      <tr key={task.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{task.wbsCode}</td>
                        <td className="px-4 py-2 font-medium">{task.name}</td>
                        <td className="px-4 py-2">
                          <Link className="text-blue-700 underline" href={`/projects/${task.project.id}`}>
                            {task.project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2"><Badge variant="outline">{label(task.status)}</Badge></td>
                        <td className={`px-4 py-2 ${isOverdue(task.plannedEndDate) ? 'text-red-700 font-semibold' : ''}`}>
                          {formatDate(task.plannedEndDate)}
                        </td>
                        <td className="px-4 py-2">{Math.round(task.actualProgress)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data && data.fieldTasks.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white overflow-x-auto">
                <h2 className="px-4 py-3 text-sm font-semibold text-slate-900 border-b border-slate-200">Field tasks</h2>
                <table className="w-full text-sm text-slate-800">
                  <thead>
                    <tr className="text-left text-slate-900 border-b border-slate-200">
                      <th className="px-4 py-2 font-semibold">Task</th>
                      <th className="px-4 py-2 font-semibold">Project</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Scheduled</th>
                      <th className="px-4 py-2 font-semibold">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fieldTasks.map(task => (
                      <tr key={task.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-medium">{task.title}</td>
                        <td className="px-4 py-2">
                          <Link className="text-blue-700 underline" href={`/projects/${task.project.id}`}>
                            {task.project.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2"><Badge variant="outline">{label(task.status)}</Badge></td>
                        <td className="px-4 py-2">{formatDate(task.scheduledDate)}</td>
                        <td className="px-4 py-2">{task.address || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
