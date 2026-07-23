import * as xlsx from 'xlsx';
import path from 'path';
import { prisma } from '../src/lib/prisma';

async function seedFNCContractors() {
    console.log('🚀 Starting FNC Contractor & Team Import from "FNC CONTRACTOR INFO 2025.xlsx"...\n');

    const filePath = path.join(process.cwd(), 'FNC CONTRACTOR INFO 2025.xlsx');
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);

    console.log(`📊 Total Excel Rows Loaded: ${rows.length}`);

    // Pre-fetch existing OPMCs
    const opmcs = await prisma.oPMC.findMany();
    const opmcMap = new Map<string, string>();
    for (const o of opmcs) {
        opmcMap.set(o.rtom.toUpperCase(), o.id);
        const cleanNoR = o.rtom.toUpperCase().replace(/^R-/, '');
        opmcMap.set(cleanNoR, o.id);
    }

    let contractorCount = 0;
    let teamCount = 0;
    let memberCount = 0;

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        const regNum = (row['SLTS Registration Number'] || row['SLTS Registration Number '] || '').toString().trim();
        const invoiceName = (row['Contractor Invoice Name'] || '').toString().trim();
        const contractorName = (row['Contractor  Name'] || row['Contractor Name'] || invoiceName || '').toString().trim();
        const contactNo = row['Contact Number'] ? row['Contact Number'].toString().trim() : null;
        const nic = row['Contractor NIC'] ? row['Contractor NIC'].toString().trim() : null;
        const rtomRaw = (row['RTOM'] || '').toString().trim().toUpperCase();

        if (!contractorName && !regNum) {
            continue;
        }

        // Resolve OPMC
        let rtomFormatted = rtomRaw.startsWith('R-') ? rtomRaw : `R-${rtomRaw}`;
        let opmcId = opmcMap.get(rtomRaw) || opmcMap.get(rtomFormatted);

        if (!opmcId && rtomRaw) {
            // Create OPMC if missing
            const newOpmc = await prisma.oPMC.create({
                data: {
                    rtom: rtomFormatted,
                    name: `OPMC ${rtomFormatted}`,
                    region: 'WESTERN'
                }
            });
            opmcId = newOpmc.id;
            opmcMap.set(rtomRaw, opmcId);
            opmcMap.set(rtomFormatted, opmcId);
        }

        const finalName = invoiceName || contractorName;
        const finalRegNum = regNum || `SLTS/OSP/2025/MANUAL-${i + 1}`;

        // Upsert Contractor
        const contractor = await prisma.contractor.upsert({
            where: { registrationNumber: finalRegNum },
            update: {
                name: finalName,
                contactNumber: contactNo,
                nic,
                status: 'ACTIVE',
                opmcId: opmcId || undefined
            },
            create: {
                registrationNumber: finalRegNum,
                name: finalName,
                contactNumber: contactNo,
                nic,
                status: 'ACTIVE',
                opmcId
            }
        });

        contractorCount++;

        // Process Teams (Team 0 to Team 5)
        const teamIndices = ['', '_1', '_2', '_3', '_4', '_5'];

        for (let tIdx = 0; tIdx < teamIndices.length; tIdx++) {
            const suffix = teamIndices[tIdx];
            const memberNameKey = `Team member Name${suffix}`;
            const memberNicKey = `Team Member NIC${suffix}`;
            const memberContactKey = `Team Member Contact Number${suffix}`;
            const teamNameKey = `I-shamp Mobile Team Name${suffix}`;

            const memberName = (row[memberNameKey] || '').toString().trim();
            const memberNic = row[memberNicKey] ? row[memberNicKey].toString().trim() : null;
            const memberContact = row[memberContactKey] ? row[memberContactKey].toString().trim() : null;
            const teamName = (row[teamNameKey] || '').toString().trim();

            if (!memberName && !teamName) {
                continue;
            }

            const finalTeamName = teamName || `${finalName} Team ${tIdx + 1}`;

            // Create/find ContractorTeam
            let team = await prisma.contractorTeam.findFirst({
                where: {
                    contractorId: contractor.id,
                    name: finalTeamName
                }
            });

            if (!team) {
                team = await prisma.contractorTeam.create({
                    data: {
                        name: finalTeamName,
                        sltCode: teamName || null,
                        contractorId: contractor.id,
                        opmcId,
                        status: 'ACTIVE'
                    }
                });
                teamCount++;
            }

            // Add Team Member if name exists
            if (memberName && memberName !== 'N/A') {
                const existingMember = await prisma.teamMember.findFirst({
                    where: {
                        contractorId: contractor.id,
                        name: memberName
                    }
                });

                if (!existingMember) {
                    await prisma.teamMember.create({
                        data: {
                            name: memberName,
                            nic: memberNic !== 'N/A' ? memberNic : null,
                            contactNumber: memberContact !== 'N/A' ? memberContact : null,
                            contractorId: contractor.id,
                            teamId: team.id
                        }
                    });
                    memberCount++;
                }
            }
        }
    }

    console.log('\n✅ FNC Contractor & Team Import Completed Successfully!');
    console.log(`   - Total Contractors Processed: ${contractorCount}`);
    console.log(`   - Total Teams Created: ${teamCount}`);
    console.log(`   - Total Team Members Added: ${memberCount}`);
}

seedFNCContractors()
    .catch((err) => {
        console.error('❌ FNC Import Failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
