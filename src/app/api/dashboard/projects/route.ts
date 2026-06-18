import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        // 1. Determine OPMC Boundaries
        let accessibleOpmcIds: string[] = [];
        if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });
            if (dbUser) {
                accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);
            }
        }

        const projectWhere: any = {};
        if (!isAdmin) {
            projectWhere.opmcId = { in: accessibleOpmcIds };
        }

        const now = new Date();

        // 2. Fetch Projects
        const allProjects = await prisma.project.findMany({
            where: projectWhere,
            include: {
                opmc: true
            }
        });

        // 3. Overview Calculations
        const activeProjectsList = allProjects.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
        const activeProjectsCount = activeProjectsList.length;

        const totalBudget = allProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
        const actualSpend = allProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0);

        const delayedProjectsList = activeProjectsList.filter(p => {
            if (!p.endDate) return false;
            const end = new Date(p.endDate);
            return end < now;
        });
        const delayedCount = delayedProjectsList.length;

        const scheduleVariance = activeProjectsCount > 0 
            ? Math.round((delayedCount / activeProjectsCount) * 100) 
            : 0;

        // 4. Status Distribution
        const statusCounts: Record<string, number> = {};
        allProjects.forEach(p => {
            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });

        const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count
        }));

        // 5. Delayed Projects Formatting
        const delayedProjectsFormatted = delayedProjectsList.map(p => {
            const end = new Date(p.endDate!);
            const delayInMs = now.getTime() - end.getTime();
            const delayInDays = Math.ceil(delayInMs / (1000 * 60 * 60 * 24));
            
            let status = 'Normal';
            if (delayInDays > 15) {
                status = 'Critical';
            } else if (delayInDays > 0) {
                status = 'Warning';
            }

            return {
                name: p.name,
                delay: delayInDays,
                progress: p.progress,
                status
            };
        }).sort((a, b) => b.delay - a.delay);

        // 6. Recent Activities from Audit Logs
        // Filter by user's OPMC if not admin? Since logs don't have direct OPMC, we can fetch recent project-related logs
        const recentLogs = await prisma.auditLog.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });

        const recentActivities = recentLogs.map(log => {
            let actionType: "approval" | "alert" | "completion" | "upload" | "creation" = "creation";
            const actionLower = log.action.toLowerCase();
            if (actionLower.includes('approve')) {
                actionType = 'approval';
            } else if (actionLower.includes('fail') || actionLower.includes('alert') || actionLower.includes('warn') || actionLower.includes('reject')) {
                actionType = 'alert';
            } else if (actionLower.includes('complete') || actionLower.includes('close')) {
                actionType = 'completion';
            } else if (actionLower.includes('upload') || actionLower.includes('import')) {
                actionType = 'upload';
            }

            return {
                user: log.user.name || log.user.email,
                action: log.action,
                target: `${log.entity} #${log.entityId}`,
                time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
                type: actionType
            };
        });

        // Add dummy logs if none exist to avoid blank state
        if (recentActivities.length === 0) {
            recentActivities.push(
                {
                    user: "System",
                    action: "initialized",
                    target: "Dashboard Engine",
                    time: "Just now",
                    type: "creation"
                }
            );
        }

        return NextResponse.json({
            overview: {
                activeProjects: activeProjectsCount,
                totalBudget,
                actualSpend,
                scheduleVariance,
                delayedCount
            },
            statusBreakdown,
            delayedProjects: delayedProjectsFormatted,
            recentActivities
        });

    } catch (error) {
        console.error('PM Dashboard Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}