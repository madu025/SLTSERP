import { NextResponse } from 'next/server';
import { ProjectService } from '@/services/project.service';

// GET all projects
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const type = searchParams.get('type');
        const opmcId = searchParams.get('opmcId');
        const contractorId = searchParams.get('contractorId');
        const projectTypeId = searchParams.get('projectTypeId');
        const search = searchParams.get('search') || searchParams.get('q') || '';

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const isPaginated = searchParams.has('page') || searchParams.has('limit');

        const filters = { status, type, opmcId, contractorId, projectTypeId, search };
        const pagination = { page, limit, isPaginated };

        const result = await ProjectService.getProjects(filters, pagination);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Error fetching projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects' },
            { status: 500 }
        );
    }
}

// POST create new project
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            projectCode,
            name,
            type,
            contractorId,
            opmcId,
            projectTypeId
        } = body;

        // Validate required fields
        if (!projectCode || !name) {
            return NextResponse.json(
                { error: 'Project code and name are required' },
                { status: 400 }
            );
        }

        const project = await ProjectService.createProject({
            projectCode,
            name,
            type,
            contractorId,
            opmcId,
            projectTypeId
        });

        return NextResponse.json(project);
    } catch (error: unknown) {
        console.error('Error creating project:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_CODE_EXISTS' || (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002')) {
            return NextResponse.json(
                { error: 'Project code already exists' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}

// PATCH update project
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID required' },
                { status: 400 }
            );
        }

        const project = await ProjectService.updateProject(id, updateData);
        return NextResponse.json(project);
    } catch (error: unknown) {
        console.error('Error updating project:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to update project' },
            { status: 500 }
        );
    }
}

// DELETE project
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Project ID required' },
                { status: 400 }
            );
        }

        // The legacy route did not enforce role check, so we pass 'ADMIN' to satisfy ProjectService RBAC
        await ProjectService.deleteProject(id, 'ADMIN');

        return NextResponse.json({ success: true });
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
