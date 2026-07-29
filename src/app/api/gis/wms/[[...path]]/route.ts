export const dynamic = 'force-dynamic';

// ============================================================================
// GeoServer WMS/WFS Proxy API
// ============================================================================
// Proxies GIS requests to GeoServer, adding authentication and logging.
// Supports WMS (tiles) and WFS (feature queries) for OpenLayers frontend.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { safe } from '@/utils/safe-await.util';

const GEOSERVER_BASE_URL = process.env.GEOSERVER_URL || 'http://geoserver:8080/geoserver';
const GEOSERVER_USER = process.env.GEOSERVER_USER || 'admin';
const GEOSERVER_PASS = process.env.GEOSERVER_PASS || 'geoserver';
const WORKSPACE = process.env.GEOSERVER_WORKSPACE || 'sltserp';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const searchParams = req.nextUrl.searchParams;

  // Build GeoServer target URL
  const pathStr = (path && path.length > 0) ? path.join('/') : '';
  const queryStr = searchParams.toString();
  const targetUrl = `${GEOSERVER_BASE_URL}/${WORKSPACE}${pathStr ? `/${pathStr}` : ''}${queryStr ? `?${queryStr}` : ''}`;

  const headers: HeadersInit = {
    'Content-Type': req.headers.get('Content-Type') || 'application/xml',
  };

  // Add Basic Auth for GeoServer
  if (GEOSERVER_USER && GEOSERVER_PASS) {
    const basicAuth = Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
  }

  const [fetchErr, response] = await safe(fetch(targetUrl, { headers }));

  if (fetchErr || !response) {
    console.error('GeoServer proxy error:', fetchErr);
    return NextResponse.json(
      { error: 'GeoServer request failed', details: fetchErr?.message },
      { status: 502 }
    );
  }

  // Determine content type from response
  const contentType = response.headers.get('content-type') || 'application/xml';

  // For WMS image tiles, return the raw image
  if (contentType.includes('image/')) {
    const [bufErr, buffer] = await safe(response.arrayBuffer());
    if (bufErr || !buffer) {
      return NextResponse.json({ error: 'Failed to read image buffer' }, { status: 500 });
    }
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
  const [textErr, text] = await safe(response.text());
  if (textErr) {
    return NextResponse.json({ error: 'Failed to read response text' }, { status: 500 });
  }

  return new NextResponse(text || '', {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await params;
  const searchParams = req.nextUrl.searchParams;

  const pathStr = (path && path.length > 0) ? path.join('/') : '';
  const queryStr = searchParams.toString();
  const targetUrl = `${GEOSERVER_BASE_URL}/${WORKSPACE}${pathStr ? `/${pathStr}` : ''}${queryStr ? `?${queryStr}` : ''}`;

  const [bodyErr, body] = await safe(req.text());
  if (bodyErr) {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  const headers: HeadersInit = {
    'Content-Type': req.headers.get('Content-Type') || 'application/xml',
  };

  if (GEOSERVER_USER && GEOSERVER_PASS) {
    const basicAuth = Buffer.from(`${GEOSERVER_USER}:${GEOSERVER_PASS}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
  }

  const [fetchErr, response] = await safe(fetch(targetUrl, {
    method: 'POST',
    headers,
    body: body || '',
  }));

  if (fetchErr || !response) {
    console.error('GeoServer proxy error:', fetchErr);
    return NextResponse.json(
      { error: 'GeoServer request failed', details: fetchErr?.message },
      { status: 502 }
    );
  }

  const contentType = response.headers.get('content-type') || 'application/xml';
  const [textErr, text] = await safe(response.text());

  return new NextResponse(text || '', {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    },
  });
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