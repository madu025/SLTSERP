import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};

    searchParams.forEach((value, key) => {
        params[key] = value;
    });

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
        headers[key] = value;
    });

    return NextResponse.json({
        message: "Diagnostic Info",
        received_query_params: params,
        received_headers: headers,
        timestamp: new Date().toISOString(),
        url: request.url
    });
}
