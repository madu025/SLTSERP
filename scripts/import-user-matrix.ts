import { prisma } from '../src/lib/prisma';

interface UserRecord {
  name: string;
  epf: string;
  isReturned: boolean;
}

interface MatrixItem {
  serialNumber: string;
  users: UserRecord[];
}

const rawMatrix: { serial: string; users: string[] }[] = [
  { serial: "3GFFMT2", users: ["RAVINDU VIMANGA (573) *", "J.M.R.P Bandara (604) *", "S.A Kasun Maduranga (1267)"] },
  { serial: "CND9123D61", users: ["K.A BUDDHIKA SAMPATH (607) *", "H.D Nimasha Madushani (791) *", "W.A,N NIROSHAN (783)"] },
  { serial: "2GHB4L2", users: ["J.A.D ANURANGA (1118) *", "S.M HALGAHAWELA (501)"] },
  { serial: "4ZJMYH3", users: ["V.ENOJAN (662) *", "Lathushanan (1706)"] },
  { serial: "5CD5370JZS", users: ["G.K Nuwan Thilina (522)", "W.M.D..K.W BANDARA (1257)"] },
  { serial: "5CD5370K2T", users: ["K.A.T.C Kumarapeli (387)", "E.M.A Kamalsiri (7965)"] },
  { serial: "5CD5370K45", users: ["W.P.A.L Nilanka (671)", "M.G.N.Damith Premadasa (492)"] },
  { serial: "5CD5370K54", users: ["M.L.L.K Mahawasala (608)", "M.H.B.K.D Herath (1802)"] },
  { serial: "5CG6110FGK", users: ["H.R WIJESIRIWARDHENA (546) *", "P.U.I Rajapaksha (995)"] },
  { serial: "5CG71924TF", users: ["THARINDU WICKRAMASINGHE (7608) *", "M.M.M ASHIF"] },
  { serial: "5CG73946B1", users: ["R.W.K.D.U KUMARA (7520) *", "R.M Asanka weerasinghe (1025)"] },
  { serial: "5CG81SSDK", users: ["P.H.R.W.M R.S.K KADUWELA (1046) *", "D.K.R LAKSHAN (INC199300203809)"] },
  { serial: "5CG8203J36", users: ["L.A KAVINDU BANDARA (1398) *", "W.M.K.S MADUBASHANA (1312)"] },
  { serial: "5TFCYH3", users: ["P.A Dushan Chanika (493) *", "M.H.B.K.D Herath (1802)"] },
  { serial: "6HOJYH3", users: ["P.B Rishan Lakmal (418) *", "R.M Wijemanna (519)"] },
  { serial: "6SBNYJ3", users: ["V.P.P Arachchi (453) *", "S.N Hewavitharana (1939)"] },
  { serial: "9TJB4L2", users: ["S.H.P Thilini Madushika (1184) *", "W.P.K.M Wickramawardene (844)"] },
  { serial: "BMBDYH3", users: ["S.A.M.D.M.K Jayalath (600) *", "D.M Chamika Madumadawa (928)"] },
  { serial: "CND537EK45", users: ["M.G.N.Damith Premadasa (492) *", "B.M.C.S Bandaranayake (1277)"] },
  { serial: "CND61042ZQ", users: ["S.A Kasun Maduranga (1267) *", "J.A.D SUMITH PRASANNA (7940)"] },
  { serial: "CND61236PN", users: ["DASUN PIYUMAL (883) *", "A.A.K.N AMARASHIGHE (1649)"] },
  { serial: "CND6123713", users: ["S.P.H.S KUMARASINGHE (1192) *", "Athula Abeyrathna (1624)"] },
  { serial: "CND72251GL", users: ["P.K.D.C Panduwawela (596) *", "N.R.C Kaushan (1326)"] },
  { serial: "CND8508N2J", users: ["P.K.D.K SANJEEWA (433) *", "I.M DINUKA MALSHAN (1335)"] },
  { serial: "CND9123DD2", users: ["D.R.P Sampath (475) *", "U.G CHATHUKA NADIRANGA (1344)"] },
  { serial: "CND9123DMO", users: ["W.M.D..K.W BANDARA (1257) *", "SAJITH KIRTHIRATHNE (1626)"] },
  { serial: "CND9123DNL", users: ["R.C.U Jayarathne (1040) *", "H.A.P.W PERERA (1831)"] },
  { serial: "CND9123DPY", users: ["C.S.A RATHNAYAKE (1303) *", "Nuwan Kanchana (540) *"] },
  { serial: "CND9123DW4", users: ["R.G.M THARAKA (934) *", "CHERANGA LAKSHAN (1185)"] },
  { serial: "CND98360BTB", users: ["Ashika Samaranayake (532) *", "A.P.K.P Pathirana (1805)"] },
  { serial: "NXA1ESG00V1440C933400", users: ["A.Umayanga Jayasooriya (616) *", "D.H.M WIJESINGHE (1195)"] },
  { serial: "PF0EGBPT", users: ["W.A DULANJI (531) *", "U.A.T.N Nawarathne (1085)"] },
  { serial: "PF0ETZY4", users: ["K.M NISHA HIRUNI (1088) *", "lakni shalika-mh"] },
  { serial: "PF3K05YT", users: ["W.P.A.L Nilanka (671) *", "H.D Nimasha Madushani (791)"] },
  { serial: "PF4C28FN", users: ["G.K Nuwan Thilina (522) *", "D.R LAKSARA (1724)"] },
  { serial: "PF4ETCMA", users: ["K.A.T.C Kumarapeli (387) *", "D.U.K JAYATHILAKE (717)"] },
  { serial: "PF4ETEW8", users: ["E.M.D.A Ekanayake (620) *", "W.M kaushika Shehan (1312)"] },
  { serial: "PF4EW0AW", users: ["I.G Sameera Nuwan (528) *", "W. Lalith Kumara Perera (7823)"] },
  { serial: "PF57G9QO", users: ["K.L.B.I.R Rupasighe (1041)", "Y.G.A.G Chandrathilaka (1130)"] },
  { serial: "SCG8181V5D", users: ["S.M.G LAKSHITHA (1090) *", "K.D.H SANJULA (1052)"] },
  { serial: "52GFYM3", users: ["M.L.L.K Mahawasala (608) *"] },
  { serial: "5CD5370JRZ", users: ["E.M.D.A Ekanayake (620)"] },
  { serial: "5CD5370JZL", users: ["K.A.Pandula Prabashwara (1133)"] },
  { serial: "5CD5370JZQ", users: ["P.B Rishan Lakmal (418)"] },
  { serial: "5CD5370JZR", users: ["E.M.D.A Ekanayake (620) *"] },
  { serial: "5CD5370K0F", users: ["Ashika Samaranayake (532)"] },
  { serial: "5CD5370K1H", users: ["R.M.I.M  Gunasekara (451)"] },
  { serial: "5CD5370K30", users: ["J.M.R.P Bandara (604)"] },
  { serial: "5CD5370K31", users: ["P.A Dushan Chanika (493)"] },
  { serial: "5CD5370K34", users: ["Nuwan Kanchana (540)"] },
  { serial: "5CD5370K3G", users: ["A.Umayanga Jayasooriya (616)"] },
  { serial: "5CD5370K3Q", users: ["R.C.U Jayarathne (1040)"] },
  { serial: "5CD5370K46", users: ["K.L.B.I.R Rupasighe (1041)"] },
  { serial: "5CD5370K4H", users: ["P.K.D.C Panduwawela (596)"] },
  { serial: "5CD5370K4J", users: ["S.A.M.D.M.K Jayalath (600)"] },
  { serial: "5CD5370K59", users: ["S.H.P Thilini Madushika (1184)"] },
  { serial: "5CD5370OZL", users: ["K.A.Pandula Prabashwara (1133) *"] },
  { serial: "5CG61110FGK", users: ["U.RAJAPAKSHA (995)"] },
  { serial: "5CG6351L7H", users: ["A,M.S SHASINDU (1390) *"] },
  { serial: "5CG7451HVJ", users: ["K.K.A DILHARA (679) *"] },
  { serial: "5CG8155D2F", users: ["A.G.S KUMARASINGHE (7561) *"] },
  { serial: "5CG8155DK", users: ["D.R LAKSARA (1724) *"] },
  { serial: "CND4465DBJ", users: ["D.U.K JAYATHILAKE (717) *"] },
  { serial: "CND61237D8", users: ["M.M GURUSINGHE (622) *"] },
  { serial: "CND61Z3780", users: ["L.B.K GUNASEKARA (487) *"] },
  { serial: "CND8140H43", users: ["AKILA PERERA (964) *"] },
  { serial: "CND836CBTJ", users: ["Muditha Ashvin Kannangara (534) *"] },
  { serial: "CND8508MNO", users: ["E.U.P.B UDAWATHTHA (1368) *"] },
  { serial: "CND9123D7R", users: ["J.T Wikcramasooriya (1745) *"] },
  { serial: "CND9123DBH", users: ["W.CHANDRAJITH (1238) *"] },
  { serial: "CND9123DSP", users: ["S.N Hewavitharana (1939) *"] },
  { serial: "CND9123DXK", users: ["G.P.P AKALANKA (1208) *"] },
  { serial: "NXA1ESG00V1440BBB0004000", users: ["W,M CHATHURA BUDDHIKA (1139) *"] },
  { serial: "PF0EG8PQ", users: ["D.H.M WIJESINGHE (1195) *"] },
  { serial: "PF0ETVJR", users: ["H.S.C EDIRISHIGHE (615) *"] },
  { serial: "PF3K9WM1", users: ["G.D.T Dharshana (TEM-HR AND ADMIN)"] },
  { serial: "PF3KT13F", users: ["K.L.B.I.R Rupasighe (1041) *"] },
  { serial: "PF56VB4M", users: ["G.P.P AKALANKA (1208)"] },
  { serial: "PF57G7CT", users: ["YEHEN DISSANAYAKE (7677)"] },
  { serial: "PF57G9QH", users: ["H.K.W.S.R BANDARA (1328)"] },
  { serial: "PF57G9S9", users: ["R.W.K.D.U KUMARA (7520)"] },
  { serial: "PF57G9TA", users: ["S.P.H.S KUMARASINGHE (1192)"] },
  { serial: "PF57G9TJ", users: ["A.B.M SHABRI (1004)"] },
  { serial: "PF57GBZP", users: ["AKILA PERERA (964)"] },
  { serial: "PF57GC02", users: ["H.R WIJESIRIWARDHENA (546)"] },
  { serial: "PF57GC05", users: ["RAVINDU VIMANGA (573)"] },
  { serial: "PF57GC1Z", users: ["P.H.R.W.M R.S.K KADUWELA (1046)"] },
  { serial: "PF57GC2G", users: ["T.H NALIN LANKA (455)"] },
  { serial: "PF57GE45", users: ["W,M CHATHURA BUDDHIKA (1139)"] },
  { serial: "PF57GE63", users: ["S.M.G LAKSHITHA (1090)"] },
  { serial: "PF57GE81", users: ["JAVANARAJ (1663)"] },
  { serial: "PF57GGDZ", users: ["DINUKA PERERA (1648)"] },
  { serial: "PF57GGEZ", users: ["L.B.K GUNASEKARA (487)"] },
  { serial: "PF57GGF5", users: ["M.M GURUSINGHE (622)"] },
  { serial: "PF57GGG4", users: ["E.U.P.B UDAWATHTHA (1368)"] },
  { serial: "PF57GGG8", users: ["L.K.S.B BATAGODA (781)"] },
  { serial: "PF57GGRP", users: ["PRASAD DISSANAYEKE (585)"] },
  { serial: "PF57GJMW", users: ["V.ENOJAN (662)"] },
  { serial: "PF57GLYE", users: ["W.A DULANJI (531)"] },
  { serial: "PF57GM15", users: ["D.R.P Sampath (475)"] },
  { serial: "PF57GPJ2", users: ["SELVARASH AKASH (1709)"] },
  { serial: "PF57GRR9", users: ["DILINI RUWIN (612)"] },
  { serial: "PF57GRSD", users: ["DASUN PIYUMAL (883)"] },
  { serial: "PF57GRV7", users: ["L.A KAVINDU BANDARA (1398)"] },
  { serial: "PF57GT2J", users: ["M.N.L .NILANKA (674)"] },
  { serial: "PF57GV09", users: ["E.M HARSHA BANDARA (1627)"] },
  { serial: "PF57GV0S", users: ["H.S.C EDIRISHIGHE (615)"] },
  { serial: "PF57GXR7", users: ["P.K.D.K SANJEEWA (433)"] },
  { serial: "PF57GXRM", users: ["A.G.S KUMARASINGHE (7561)"] },
  { serial: "PF57H0PJ", users: ["J.A.D ANURANGA (1118)"] },
  { serial: "PF57H2YJ", users: ["R.G.M THARAKA (934)"] },
  { serial: "PF57H58R", users: ["A,M.S SHASINDU (1390)"] },
  { serial: "PF57H7E2", users: ["W.W Shanaka Niranjan (1098)"] },
  { serial: "PF57H7E8", users: ["K.A BUDDHIKA SAMPATH (607)"] },
  { serial: "PF57H7GY", users: ["M.W AMILA SAMAN (7711)"] },
  { serial: "PF57MMQ7", users: ["W.CHANDRAJITH (1238)"] },
  { serial: "PF57MMRL", users: ["THARINDU WICKRAMASINGHE (7608)"] },
  { serial: "PF57MQ3Y", users: ["I.U.K DE Silva (7481)"] },
  { serial: "PF57MQ51", users: ["K.K.A DILHARA (679)"] },
  { serial: "PF57VAVC", users: ["C.S.A RATHNAYAKE (1303)"] },
  { serial: "PF57VB53", users: ["K.M NISHA HIRUNI (1088)"] },
  { serial: "PF5827N6", users: ["B.L Pavithra Madushani (599)"] },
  { serial: "PF5827NL", users: ["E.M.Sajith Senarathne (1114)"] },
  { serial: "PF582NZ3", users: ["J.T Wikcramasooriya (1745)"] },
  { serial: "PF584722", users: ["W.M.A. Chethana Priyadarshana (1779)"] },
  { serial: "PF584BM8", users: ["K.G.Hirushan sandupa (7782)"] },
  { serial: "PF584JDM", users: ["Muditha Ashvin Kannangara (534)"] },
  { serial: "PF5TW2HZ", users: ["G.K Nuwan Thilina (522)"] },
  { serial: "PF5TWLF3", users: ["K.A.T.C Kumarapeli (387)"] },
  { serial: "PF5TWLG1", users: ["KAMAL WIJAYALATH"] },
  { serial: "PF5TYC70", users: ["M.L.L.K Mahawasala (608)"] },
  { serial: "PF5V2DA7", users: ["E.M.D.A Ekanayake (620)"] },
  { serial: "PF5VN0GQ", users: ["K.A.Pandula Prabashwara (1133)"] },
  { serial: "PF5VP6EB", users: ["W.P.A.L Nilanka (671)"] },
  { serial: "PF5VSAVA", users: ["V.P.P Arachchi (453)"] },
  { serial: "PG04ZS6K", users: ["P.M Gamage (7786)"] },
  { serial: "T6NRCX05Y467267", users: ["Y T Kodithuwakku (721)"] },
  { serial: "T8NRCX068123343", users: ["B.L.D Kavinda (1738)"] },
  { serial: "T8NRCX068317347", users: ["A.L.R Kalogasthenna (1765)"] },
  { serial: "T8NRCX06836834C", users: ["K.G Achini Wikcramarathne (7768)"] },
  { serial: "T8NRCX068380346", users: ["A.H.M.D.D Bandara (1110)"] },
  { serial: "T8NRCX068416341", users: ["I.G Sameera Nuwan (528)"] }
];

function parseUser(rawStr: string): UserRecord {
  const isReturned = rawStr.includes('*');
  const cleanStr = rawStr.replace('*', '').trim();
  
  // Extract EPF inside parentheses
  const match = cleanStr.match(/(.+)\((.+)\)/);
  if (match) {
    return {
      name: match[1].trim(),
      epf: match[2].trim(),
      isReturned
    };
  }
  
  return {
    name: cleanStr,
    epf: "",
    isReturned
  };
}

async function main() {
  console.log(`[MATRIX-SYNC] Syncing database to match user-provided matrix...`);

  // Get administrative user to set as performer
  const adminUser = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN" }
  }) || await prisma.user.findFirst();

  if (!adminUser) {
    console.error(`[MATRIX-SYNC] ERROR: No administrator user found in database.`);
    return;
  }

  let staffCreated = 0;
  let staffUpdated = 0;

  // First, verify all users exist and are aligned
  for (const item of rawMatrix) {
    for (const rawUser of item.users) {
      const parsed = parseUser(rawUser);
      if (!parsed.name) continue;

      // Skip invalid placeholders
      if (parsed.name === "NAME" || parsed.epf === "EMP NUMBER" || parsed.name.toLowerCase() === "lakni shalika-mh" || parsed.name.toLowerCase() === "m.m.m ashif") {
        continue;
      }

      // Check if staff by EPF exists
      if (parsed.epf) {
        const existing = await prisma.staff.findUnique({
          where: { employeeId: parsed.epf }
        });

        if (!existing) {
          // Match by name keyword to update
          let matchedStaff = null;
          const cleanParts = parsed.name.split(/[\s\.]+/).filter((p: string) => p.length > 3);
          
          if (cleanParts.length > 0) {
            const candidates = await prisma.staff.findMany({
              where: {
                OR: cleanParts.map((part: string) => ({
                  name: { contains: part, mode: 'insensitive' }
                }))
              }
            });
            if (candidates.length > 0) matchedStaff = candidates[0];
          }

          if (matchedStaff) {
            await prisma.staff.update({
              where: { id: matchedStaff.id },
              data: { employeeId: parsed.epf }
            });
            console.log(`[MATRIX-SYNC] Updated Staff ID: "${matchedStaff.name}" -> numeric EPF "${parsed.epf}"`);
            staffUpdated++;
          } else {
            await prisma.staff.create({
              data: {
                name: parsed.name,
                employeeId: parsed.epf,
                designation: "ENGINEER"
              }
            });
            console.log(`[MATRIX-SYNC] Created Staff Profile: "${parsed.name}" with EPF "${parsed.epf}"`);
            staffCreated++;
          }
        }
      }
    }
  }

  console.log(`\n[MATRIX-SYNC] Staff directory synchronized. Created: ${staffCreated}, Updated: ${staffUpdated}`);

  // Second, re-align IT Assets and log handovers exactly per the history matrix
  let assetsMapped = 0;

  for (const item of rawMatrix) {
    const dbAsset = await prisma.iTAsset.findUnique({
      where: { serialNumber: item.serial }
    });

    if (dbAsset) {
      // Clear old logs for this specific asset to ensure clean matrix seeding
      await prisma.assetHandoverLog.deleteMany({
        where: { assetId: dbAsset.id }
      });

      // Process users left-to-right (chronologically)
      let currentActiveStaffId: string | null = null;
      let finalStatus: any = "SPARE";
      let finalLocation = dbAsset.location || "Stores";

      for (let i = 0; i < item.users.length; i++) {
        const rawUser = item.users[i];
        const parsed = parseUser(rawUser);

        if (!parsed.name) continue;

        // Find staff member
        let staff = null;
        if (parsed.epf) {
          staff = await prisma.staff.findUnique({
            where: { employeeId: parsed.epf }
          });
        }

        const isLastUser = (i === item.users.length - 1);

        if (staff) {
          // Log ISSUE transaction
          await prisma.assetHandoverLog.create({
            data: {
              assetId: dbAsset.id,
              transactionType: "ISSUED_TO_USER",
              performedById: adminUser.id,
              targetStaffId: staff.id,
              remarks: `Device issued to ${parsed.name} (${parsed.epf}) per historical matrix seeding.`,
              date: new Date(Date.now() - (item.users.length - i) * 24 * 60 * 60 * 1000) // fake chronological stagger
            }
          });

          if (parsed.isReturned) {
            // Log RETURN transaction
            await prisma.assetHandoverLog.create({
              data: {
                assetId: dbAsset.id,
                transactionType: "RETURNED_TO_STORE",
                performedById: adminUser.id,
                targetStaffId: staff.id,
                remarks: `Device returned to stores by ${parsed.name} (${parsed.epf}) per historical matrix seeding.`,
                date: new Date(Date.now() - (item.users.length - i - 0.5) * 24 * 60 * 60 * 1000)
              }
            });
          }

          if (isLastUser && !parsed.isReturned) {
            // This is the current active custodian
            currentActiveStaffId = staff.id;
            finalStatus = "ACTIVE";
            finalLocation = "OSP Field";
          }
        }
      }

      // Update current status and custodian in asset model
      await prisma.iTAsset.update({
        where: { id: dbAsset.id },
        data: {
          assignedStaff: currentActiveStaffId ? { connect: { id: currentActiveStaffId } } : { disconnect: true },
          status: finalStatus,
          location: finalLocation
        }
      });
      assetsMapped++;
    }
  }

  console.log(`[MATRIX-SYNC] IT Assets assignments successfully seeded according to user-supplied matrix! Mapped: ${assetsMapped}`);
}

main().catch(console.error);
