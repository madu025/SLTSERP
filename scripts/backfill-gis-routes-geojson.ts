import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill for GISRoute geojsonData...");

  const routes = await prisma.gISRoute.findMany({
    include: {
      poles: true,
      chambers: true,
      closures: true,
      cableSegments: true,
    },
  });

  console.log(`Found ${routes.length} total routes in database.`);

  let updatedCount = 0;

  for (const r of routes) {
    console.log(`Processing Route ID: ${r.id} | Name: ${r.name}`);

    // If it already has geojsonData with features, we can skip or overwrite.
    // Let's rebuild to guarantee accurate rendering on the National Map.
    const features: any[] = [];

    // Cables
    r.cableSegments.forEach((seg) => {
      // Decode coordinates properties if stored as JSON or array
      let coords = seg.properties && (seg.properties as any).coordinates;
      if (!coords && seg.fromPoleId) {
        // Fallback to pole coordinates if segment doesn't have coordinates
      }
      
      // Let's check coordinates structure
      if (Array.isArray(coords)) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
          properties: {
            layer: 'CABLE',
            cable_type: seg.cableType || '24F SM',
            fiber_count: seg.fiberCount || 24,
            length: seg.length,
            ...((seg.properties as any) || {}),
          },
        });
      }
    });

    // Poles
    r.poles.forEach((pole) => {
      if (pole.longitude && pole.latitude) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [pole.longitude, pole.latitude],
          },
          properties: {
            layer: 'POLE',
            pole_number: pole.poleNumber ? `PL-${pole.poleNumber}` : ((pole.properties as any)?.PL_Number || `PL-${pole.id}`),
            pole_type: pole.poleType,
            height: pole.height,
            ...((pole.properties as any) || {}),
          },
        });
      }
    });

    // Chambers
    r.chambers.forEach((chamber) => {
      if (chamber.longitude && chamber.latitude) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [chamber.longitude, chamber.latitude],
          },
          properties: {
            layer: 'CHAMBER',
            chamber_number: (chamber.properties as any)?.Chamber_Number || `CH-${chamber.id}`,
            ...((chamber.properties as any) || {}),
          },
        });
      }
    });

    // Closures
    r.closures.forEach((closure) => {
      if (closure.longitude && closure.latitude) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [closure.longitude, closure.latitude],
          },
          properties: {
            layer: 'FIBER_JOINT',
            joint_number: (closure.properties as any)?.Joint_Number || `JT-${closure.id}`,
            ...((closure.properties as any) || {}),
          },
        });
      }
    });

    if (features.length > 0) {
      await prisma.gISRoute.update({
        where: { id: r.id },
        data: {
          geojsonData: {
            type: 'FeatureCollection',
            features,
          },
        },
      });
      console.log(`  -> Successfully updated Route ID: ${r.id} with ${features.length} features.`);
      updatedCount++;
    } else {
      console.log(`  -> No spatial elements (poles/cables/etc.) found to construct GeoJSON for Route ID: ${r.id}.`);
    }
  }

  console.log(`Backfill completed. Updated ${updatedCount} routes.`);
}

main()
  .catch((e) => {
    console.error("Error running backfill:", e);
  })
  .finally(() => prisma.$disconnect());
