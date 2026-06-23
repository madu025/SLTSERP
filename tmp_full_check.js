const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const counts = await Promise.all([
    p.gISRoute.count(),
    p.gISPole.count(),
    p.gISChamber.count(),
    p.gISClosure.count(),
    p.gISCableSegment.count(),
    p.surveyPoint.count(),
    p.project.count(),
    p.fieldTask.count(),
    p.qFieldCloudSyncLog ? p.qFieldCloudSyncLog.count().catch(() => "model missing") : "model missing",
    p.gISGeneratedBOQ.count(),
    p.projectBOQItem.count(),
  ]);

  console.log("Routes:       " + counts[0]);
  console.log("Poles:        " + counts[1]);
  console.log("Chambers:     " + counts[2]);
  console.log("Closures:     " + counts[3]);
  console.log("Cable Segs:   " + counts[4]);
  console.log("Survey Pts:   " + counts[5]);
  console.log("Projects:     " + counts[6]);
  console.log("Field Tasks:  " + counts[7]);
  console.log("Sync Logs:    " + counts[8]);
  console.log("Gen BOQ:      " + counts[9]);
  console.log("Proj BOQ:     " + counts[10]);

  // Check if project has gisMapping (qfield project ID)
  console.log("\n=== PROJECT GIS MAPPING ===");
  const proj = await p.project.findFirst({
    where: { projectCode: "SME-SNR-0555" },
    select: { id: true, gisMapping: true },
  });
  console.log(JSON.stringify(proj, null, 2));

  // Check survey points with coordinates
  console.log("\n=== SURVEY POINT SAMPLE ===");
  const pts = await p.surveyPoint.findMany({ take: 3, select: { id: true, layerId: true, latitude: true, longitude: true, verificationStatus: true } });
  console.log(JSON.stringify(pts, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});