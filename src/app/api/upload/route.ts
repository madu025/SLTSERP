import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { writeFile, mkdir } from "fs/promises";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Convert to Base64 Data URI
        const mimeType = file.type || 'application/octet-stream';
        const base64Data = buffer.toString('base64');
        const dataUri = `data:${mimeType};base64,${base64Data}`;

        // Return the Data URI as the 'url'
        return NextResponse.json({ url: dataUri });
    } catch (error: any) {
        console.error("Critical Upload Error:", error);
        return NextResponse.json({
            error: "Upload failed",
            details: error.message
        }, { status: 500 });
    }
}
