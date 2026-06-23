const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  const proj = await p.project.findFirst({
    where: { id: "cmqpa22sz0000sik8eos6y9o0" },
    select: {
      id: true,
      name: true,
      status: true,
      _count: {
        select: {
          gisRoutes: true,
          surveyRequests: true,
          fieldTasks: true,
        },
      },
    },
  });

  console.log("=== PROJECT ===");
  console.log(JSON.stringify(proj, null, 2));

  // Get survey points details
  console.log("\n=== SURVEY POINTS (for map) ===");
  const pts = await p.surveyPoint.findMany({
    take: 10,
    select: {
      id: true,
      layerId: true,
      layerName: true,
      latitude: true,
      longitude: true,
      verificationStatus: true,
      photoUrls: true,
      attributes: true,
    },
  });
  console.log(JSON.stringify(pts, null, 2));

  // Check survey requests
  console.log("\n=== SURVEY REQUESTS ===");
  const reqs = await p.surveyRequest.findMany({
    take: 5,
    select: { id: true, title: true, status: true, requestNumber: true },
  });
  console.log(JSON.stringify(reqs, null, 2));

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});