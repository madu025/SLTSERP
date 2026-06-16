import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Authority Entities and Permit Types...");

  const authorityList = [
    { name: "Road Development Authority", sn: "RDA" },
    { name: "Sri Lanka Railways", sn: "SLR" },
    { name: "Municipal Council", sn: "MC" },
    { name: "Urban Development Authority", sn: "UDA" },
    { name: "Central Environmental Authority", sn: "CEA" },
    { name: "Pradeshiya Sabha", sn: "PS" },
    { name: "Ceylon Electricity Board", sn: "CEB" },
    { name: "National Water Supply and Drainage Board", sn: "NWSDB" },
  ];

  const map: Record<string, string> = {};

  for (const a of authorityList) {
    let e = await prisma.authorityEntity.findFirst({ where: { name: a.name } });
    if (e) {
      await prisma.authorityEntity.update({
        where: { id: e.id },
        data: { shortName: a.sn, isActive: true },
      });
    } else {
      e = await prisma.authorityEntity.create({
        data: { name: a.name, shortName: a.sn, isActive: true },
      });
    }
    map[a.name] = e.id;
  }
  console.log("Authorities: " + authorityList.length + " seeded");

  const pts = [
    { code: "ROAD_CUTTING", name: "Road Cutting Permit", a: "Road Development Authority", d: 90, r: true },
    { code: "ROAD_CROSSING", name: "Road Crossing Permit", a: "Road Development Authority", d: 90, r: true },
    { code: "ROW_ACCESS", name: "Right of Way Access", a: "Road Development Authority", d: 180, r: false },
    { code: "RAILWAY_CROSSING", name: "Railway Crossing Permit", a: "Sri Lanka Railways", d: 90, r: true },
    { code: "RAILWAY_ROW", name: "Railway Right of Way", a: "Sri Lanka Railways", d: 180, r: false },
    { code: "WAYLEAVE", name: "Wayleave Agreement", a: "Municipal Council", d: 365, r: true },
    { code: "BUILDING_ACCESS", name: "Building Access Permit", a: "Municipal Council", d: 90, r: false },
    { code: "PARKING_SUSPENSION", name: "Parking Suspension Permit", a: "Municipal Council", d: 30, r: true },
    { code: "STREET_FURNITURE", name: "Street Furniture Installation", a: "Municipal Council", d: 365, r: true },
    { code: "DEVELOPMENT_PERMIT", name: "Development Permit", a: "Urban Development Authority", d: 365, r: false },
    { code: "ENV_CLEARANCE", name: "Environmental Clearance", a: "Central Environmental Authority", d: 180, r: false },
    { code: "TREE_TRIMMING", name: "Tree Trimming Permit", a: "Central Environmental Authority", d: 30, r: true },
    { code: "LOCAL_AUTHORITY", name: "Local Authority Approval", a: "Pradeshiya Sabha", d: 365, r: true },
    { code: "POLE_SHARING", name: "Pole Sharing Agreement", a: "Ceylon Electricity Board", d: 365, r: true },
    { code: "DUCT_SHARING", name: "Duct Sharing Agreement", a: "Ceylon Electricity Board", d: 365, r: true },
    { code: "WATER_CROSSING", name: "Water Pipeline Crossing", a: "National Water Supply and Drainage Board", d: 90, r: true },
    { code: "DRAIN_CROSSING", name: "Drainage Crossing Permit", a: "National Water Supply and Drainage Board", d: 90, r: true },
  ];

  let c = 0;
  for (const p of pts) {
    const aid = map[p.a];
    if (!aid) {
      console.warn("Authority not found: " + p.a);
      continue;
    }
    await prisma.permitType.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        authorityId: aid,
        defaultDuration: p.d,
        requiresRenewal: p.r,
      },
      create: {
        code: p.code,
        name: p.name,
        authorityId: aid,
        defaultDuration: p.d,
        requiresRenewal: p.r,
      },
    });
    c++;
  }
  console.log(c + " permit types seeded");
  console.log("Authority and Permit seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });