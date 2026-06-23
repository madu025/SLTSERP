const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // Get all survey points with full detail
  console.log("=== ALL SURVEY POINTS ===");
  const pts = await p.surveyPoint.findMany({
    select: {
      id: true,
      projectId: true,
      sessionId: true,
      layerId: true,
      layerName: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      photoUrls: true,
      attributes: true,
    }
  });
  console.log(JSON.stringify(pts, null, 2));
  console.log(`Total: ${pts.length}`);

  // Check what layers data has
  console.log("\n=== LAYER COUNTS ===");
  const layers = await p.surveyPoint.groupBy({
    by: ["layerId"],
    _count: { id: true }
  });
  console.log(JSON.stringify(layers, null, 2));

  // Check survey sessions
  console.log("\n=== SURVEY SESSIONS ===");
  const sessions = await p.surveySession.findMany({
    select: { id: true, projectId: true, status: true }
  });
  console.log(JSON.stringify(sessions, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});