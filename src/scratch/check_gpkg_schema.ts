import Database from 'better-sqlite3';
import path from 'path';

function main() {
  const dbPath = path.resolve(process.cwd(), 'LK_mapwithai_road_data.gpkg');
  const db = new Database(dbPath, { readonly: true });
  
  // Get table info
  const info = db.prepare("PRAGMA table_info(LK_mapwithai_road_data)").all();
  console.log('Columns:', info);

  // Get count
  const count = db.prepare("SELECT count(*) as total FROM LK_mapwithai_road_data").get() as { total: number };
  console.log('Total rows:', count.total);

  // Get a sample row
  const sample = db.prepare("SELECT * FROM LK_mapwithai_road_data LIMIT 1").get();
  console.log('Sample row:', sample);
}

main();
