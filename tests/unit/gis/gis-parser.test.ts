import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gisParser } from '../../../src/lib/gis/gis-parser';

describe('GIS format detection and QGIS optional handling', () => {
  it('recognises QGIS projects as optional project files', () => {
    assert.equal(gisParser.isQGISProjectFile('QGIS.qgz'), true);
    assert.equal(gisParser.isQGISProjectFile('QGIS.qgs'), true);
    assert.equal(gisParser.isQGISProjectFile('KL-SVK-0567_Cables.geojson'), false);
    assert.equal(gisParser.detectFileFormat('QGIS.qgz'), 'QGIS');
  });

  it('keeps non-QGIS GeoJSON imports independent of a QGIS file', () => {
    const parsed = gisParser.autoParseLayer(
      'KL-SVK-0567_Cables.geojson',
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { cable_type: '24F SM' },
            geometry: {
              type: 'LineString',
              coordinates: [
                [79.85, 6.93],
                [79.851, 6.931],
              ],
            },
          },
        ],
      }),
    );

    assert.equal(parsed.layerType, 'CABLE');
    assert.equal(parsed.parsedData.featureCount, 1);
  });

  it('does not mislabel unsupported extensions as GeoJSON', () => {
    assert.equal(gisParser.detectFileFormat('survey.csv'), 'CSV');
    assert.equal(gisParser.detectFileFormat('survey.dxf'), 'DXF');
    assert.equal(gisParser.detectFileFormat('survey.bin'), 'UNKNOWN');
  });
});
