/* Show the Daily Operational Report row for a specific RTOM.
 * Usage: node scripts/tmp-show-rkx-report.js [YYYY-MM-DD] [RTOM]
 */
const { ReportService } = require('../src/services/core/report.service');

const dateArg = process.argv[2] || '2026-09-03';
const rtom = process.argv[3] || 'R-KX';

async function main() {
    const { reportData, date, snapshot } = await ReportService.getDailyOperationalReport({ date: dateArg });
    const row = reportData.find(r => r.rtom === rtom);
    if (!row) {
        console.log(`No row found for ${rtom} on ${date}`);
        return;
    }
    console.log(`Daily Operational Report: ${date} | RTOM: ${rtom} | snapshot: ${snapshot}`);
    console.log(`Region: ${row.region} | Province: ${row.province}`);
    console.log('--- Metrics ---');
    console.log(`C/F (In Hand AM):  NC=${row.inHandMorning.nc}  RL=${row.inHandMorning.rl}  DATA=${row.inHandMorning.data}  Total=${row.inHandMorning.total}`);
    console.log(`SOD Receiving:    NC=${row.received.nc}  RL=${row.received.rl}  DATA=${row.received.data}  Total=${row.received.total}`);
    console.log(`Install Closed:   NC=${row.installClosed.nc}  RL=${row.installClosed.rl}  DATA=${row.installClosed.data}  Total=${row.installClosed.total}`);
    console.log(`Completed:        NC=${row.completed.nc}  RL=${row.completed.rl}  DATA=${row.completed.data}  Total=${row.completed.total}`);
    console.log(`  FNC (CR+RC+UP): ${row.completed.fnc}`);
    console.log(`  FRL (OR+ML):    ${row.completed.frl}`);
    console.log(`Returned:         NC=${row.returned.nc}  RL=${row.returned.rl}  DATA=${row.returned.data}  Total=${row.returned.total}`);
    console.log(`Wired Only:       NC=${row.wiredOnly.nc}  RL=${row.wiredOnly.rl}  DATA=${row.wiredOnly.data}  Total=${row.wiredOnly.total}`);
    console.log(`Balance C/F:      NC=${row.balance.nc}  RL=${row.balance.rl}  DATA=${row.balance.data}  Total=${row.balance.total}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
