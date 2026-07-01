import { NextRequest, NextResponse } from "next/server";
import { ProjectSurveyService } from "@/services/project-survey.service";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();

        const result = await ProjectSurveyService.completeSurveyAndGenerateBOQ(projectId, body);
        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        console.error("survey-complete error:", error);
        const message = error.message;
        if (message === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to complete survey" }, { status: 500 });
    }
}
