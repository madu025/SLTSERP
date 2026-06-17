// ============================================================================
// GeoServer WMS/WFS Proxy API
// ============================================================================
// Proxies GIS requests to GeoServer, adding authentication and logging.
// Supports WMS (tiles) and WFS (feature queries) for OpenLayers frontend.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

const GEOSERVER_BASE_URL = process.env.GEOSERVER_URL || 'http://geoserver:8080/geoserver';
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASS = process.env.GEOSERVER_PASS || 'geoserver';
const WORKSPACE = process.env.GEOSERVER_WORKSPACE || 'sltserp';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = req.nextUrl.searchParams;

  // Build GeoServer target URL
  const pathStr = path.join('/');
  const queryStr = searchParams.toString();
  const targetUrl = `${GEOSERVER_BASE_URL}/${WORKSPACE}/${pathStr}${queryStr ? `?${queryStr}` : ''}`;

  try {
    const headers: HeadersInit = {
      'Content-Type': req.headers.get('Content-Type') || 'application/xml',
    };

    // Add Basic Auth for GeoServer
    if (GEOSERVER_USER && GEOSERVER_PASS) {
      const basicAuth = Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    const response = await fetch(targetUrl, { headers });

    // Determine content type from response
    const contentType = response.headers.get('content-type') || 'application/xml';

    // For WMS image tiles, return the raw image
    if (contentType.includes('image/')) {
      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // For WFS/WMS text responses (XML, JSON, GeoJSON)
    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('GeoServer proxy error:', error);
    return NextResponse.json(
      { error: 'GeoServer request failed', details: error.message },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = req.nextUrl.searchParams;

  const pathStr = path.join('/');
  const queryStr = searchParams.toString();
  const targetUrl = `${GEOSERVER_BASE_URL}/${WORKSPACE}/${pathStr}${queryStr ? `?${queryStr}` : ''}`;

  try {
    const body = await req.text();

    const headers: HeadersInit = {
      'Content-Type': req.headers.get('Content-Type') || 'application/xml',
    };

    if (GEOSERVER_USER && GEOSERVER_PASS) {
      const basicAuth = Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');
      headers['Authorization'] = `Basic ${basicAuth}`;
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body,
    });

    const contentType = response.headers.get('content-type') || 'application/xml';
    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    console.error('GeoServer proxy error:', error);
    return NextResponse.json(
      { error: 'GeoServer request failed', details: error.message },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}