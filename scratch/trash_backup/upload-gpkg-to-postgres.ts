import { PrismaClient } from '@prisma/client';
import Database from 'better-sqlite3';
import path from 'path';

const prisma = new PrismaClient();

function getWKTBounds(wkt: string) {
  if (!wkt || !wkt.startsWith('LINESTRING')) {
    return { minLat: null, maxLat: null, minLon: null, maxLon: null };
  }
  const content = wkt.substring(wkt.indexOf('(') + 1, wkt.indexOf(')'));
  const pairs = content.split(', ');
  
  let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
  for (const pair of pairs) {
    const [lonStr, latStr] = pair.split(' ');
    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

async function main() {
  const dbPath = path.resolve(process.cwd(), 'LK_mapwithai_road_data.gpkg');
  console.log(`Connecting to GPKG SQLite database: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  const totalRows = (db.prepare("SELECT count(*) as total FROM LK_mapwithai_road_data").get() as any).total;
  console.log(`Total rows in GPKG: ${totalRows}`);

  // Clear existing table to ensure schema consistency
  console.log("Truncating existing GISRoadData table in PostgreSQL...");
  await prisma.gISRoadData.deleteMany();
  console.log("Table truncated.");

  const chunkSize = 10000;
  let offset = 0;
  
  console.log("Starting data migration to PostgreSQL with spatial bounding boxes...");
  const startTime = Date.now();

  while (offset < totalRows) {
    console.log(`Fetching rows ${offset} to ${offset + chunkSize} from GPKG...`);
    const rows = db.prepare(`SELECT fid, way_fbid, highway_tag, wkt FROM LK_mapwithai_road_data LIMIT ? OFFSET ?`).all(chunkSize, offset) as any[];

    if (rows.length === 0) break;

    const data = rows
      .filter(r => r.wkt !== null)
      .map(r => {
        const bounds = getWKTBounds(r.wkt);
        return {
          fid: Number(r.fid),
          wkt: r.wkt,
          wayFbid: r.way_fbid ? String(r.way_fbid) : null,
          highwayTag: r.highway_tag ? String(r.highway_tag) : null,
          minLat: bounds.minLat,
          maxLat: bounds.maxLat,
          minLon: bounds.minLon,
          maxLon: bounds.maxLon
        };
      });

    console.log(`Inserting ${data.length} rows with bounding boxes into PostgreSQL...`);
    
    await prisma.gISRoadData.createMany({
      data,
      skipDuplicates: true
    });

    offset += rows.length;
    const elapsedMinutes = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`Progress: ${offset}/${totalRows} (${((offset / totalRows) * 100).toFixed(2)}%) | Elapsed: ${elapsedMinutes}m`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Migration complete! Successfully migrated ${totalRows} rows in ${duration} seconds.`);
}

main()
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
