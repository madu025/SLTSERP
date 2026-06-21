"use client";
 
import React, { use, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import QFieldConfigForm from '@/components/projects/QFieldConfigForm';
import { Skeleton } from '@/components/ui/skeleton';
 
export default function QFieldConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<{ id: string; projectCode: string; name: string } | null>(null);
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
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <Header />
        <div className="flex-1 p-3 md:p-4 lg:p-5 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {loading ? (
              <div className="space-y-6">
                <Skeleton className="h-7 w-48 bg-muted" />
                <Skeleton className="h-[400px] w-full rounded-lg bg-muted" />
              </div>
            ) : project ? (
              <QFieldConfigForm
                projectId={project.id}
                projectCode={project.projectCode}
                projectName={project.name}
              />
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Project not found
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
