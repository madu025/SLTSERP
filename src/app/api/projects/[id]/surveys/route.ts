import { NextRequest, NextResponse } from "next/server";
import { ProjectSurveyService } from "@/services/project-survey.service";

// GET: List survey requests with checkins, photos, findings count
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const surveyType = searchParams.get("surveyType");

        const surveys = await ProjectSurveyService.getSurveyRequests(projectId, { status, surveyType });
        return NextResponse.json(surveys);
    } catch (error) {
        console.error("Error fetching surveys:", error);
        return NextResponse.json({ error: "Failed to fetch surveys" }, { status: 500 });
    }
}

// POST: Create survey request with auto-generated requestNumber (SRV-{year}-{sequential})
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { title, surveyType, createdById } = body;

        if (!title || !surveyType || !createdById) {
            return NextResponse.json({ error: "title, surveyType, and createdById are required" }, { status: 400 });
        }

        const survey = await ProjectSurveyService.createSurveyRequest(projectId, body);
        return NextResponse.json(survey, { status: 201 });
    } catch (error) {
        console.error("Error creating survey request:", error);
        return NextResponse.json({ error: "Failed to create survey request" }, { status: 500 });
    }
}
