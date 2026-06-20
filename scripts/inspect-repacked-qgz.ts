import * as fs from 'fs';
import * as path from 'path';
import * as admZip from 'adm-zip';

const qgzPath = 'QGIS Project Template/QGIS.qgz';
if (!fs.existsSync(qgzPath)) {
  console.error(`Error: ${qgzPath} not found.`);
  process.exit(1);
}

try {
  const zip = new admZip(qgzPath);
  const zipEntries = zip.getEntries();
  const qgsEntry = zipEntries.find(entry => entry.entryName.endsWith('.qgs'));
  
  if (!qgsEntry) {
    console.error('QGS file not found inside QGZ.');
    process.exit(1);
  }
  
  const content = qgsEntry.getData().toString('utf8');
  
  // Simple XML parsing/regex to find layers and datasources
  const maplayerRegex = /<maplayer[^>]*>([\s\S]*?)<\/maplayer>/g;
  let match;
  while ((match = maplayerRegex.exec(content)) !== null) {
    const layerXml = match[1];
    const nameMatch = /<layername>([^<]*)<\/layername>/.exec(layerXml);
    if (nameMatch && nameMatch[1].startsWith('SLT_')) {
      const name = nameMatch[1];
      const datasourceMatch = /<datasource>([^<]*)<\/datasource>/.exec(layerXml);
      const providerMatch = /<provider>([^<]*)<\/provider>/.exec(layerXml);
      console.log(`Layer: ${name}`);
      console.log(`  - Provider: ${providerMatch ? providerMatch[1] : 'None'}`);
      console.log(`  - Datasource: ${datasourceMatch ? datasourceMatch[1] : 'None'}`);
    }
  }
} catch (e: any) {
  console.error('Error inspecting zip:', e.message || e);
}
