import { NextResponse } from 'next/server';
import { ProjectService } from '@/services/project.service';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const project = await ProjectService.getProjectDetails(id);
        return NextResponse.json(project);
    } catch (error: unknown) {
        console.error('Error fetching project details:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to fetch project details' },
            { status: 500 }
        );
    }
}

// DELETE project - Admin/Super Admin only
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userRole = request.headers.get('x-user-role');
        const { id } = await params;

        await ProjectService.deleteProject(id, userRole);

        return NextResponse.json({ success: true, message: 'Project deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting project:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'FORBIDDEN') {
            return NextResponse.json(
                { error: 'Unauthorized: Only Admin or Super Admin can delete projects' },
                { status: 403 }
            );
        }
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to delete project' },
            { status: 500 }
        );
    }
}
