import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await context.params;
        
        // Resolve path to the secure uploads directory
        const rootDir = process.cwd();
        const filePath = path.join(rootDir, "uploads", "contractors", filename);

        console.log("[FILES-API] Attempting to serve file:", filePath);

        // Check if file exists
        if (!existsSync(filePath)) {
            console.error("[FILES-API] File not found:", filePath);
            return new NextResponse("File not found", { status: 404 });
        }

        // Read the file buffer
        const buffer = await readFile(filePath);

        // Determine content type based on extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = "application/octet-stream";
        
        if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
        else if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".pdf") contentType = "application/pdf";
        else if (ext === ".svg") contentType = "image/svg+xml";

        // Return the file with correct headers
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (error: any) {
        console.error("[FILES-API] Error serving file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
