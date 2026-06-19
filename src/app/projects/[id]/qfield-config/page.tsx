"use client";

import React, { use, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import QFieldConfigForm from '@/components/projects/QFieldConfigForm';
import { Skeleton } from '@/components/ui/skeleton';

export default function QFieldConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (res.ok) {
          const data = await res.json();
          setProject(data);
        }
      } catch (err) {
        console.error("Failed to load project details:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProject();
  }, [id]);

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <Header />
        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-[400px] w-full rounded-lg" />
              </div>
            ) : project ? (
              <QFieldConfigForm
                projectId={project.id}
                projectCode={project.projectCode}
                projectName={project.name}
              />
            ) : (
              <div className="text-center py-12 text-slate-500">
                Project not found
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
