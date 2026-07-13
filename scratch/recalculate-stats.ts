import { StatsService } from '../src/lib/stats.service';

async function main() {
    console.log('Starting global recalculation of stats...');
    await StatsService.globalRecalculate();
    console.log('Global recalculation completed successfully!');
}

main().catch(console.error);
