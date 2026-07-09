export function getCablePopupHtml(seg: any, route: any): string {
  const slackBtn = seg.status === 'PLANNED'
    ? `<button onclick="window.addSlackLoopToSegment('${seg.id}')" style="margin-top: 8px; width: 100%; background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">➕ Add Tension Slack Loop (+20m)</button>`
    : '';
  return `
    <div style="font-family: sans-serif; min-width: 200px;">
      <h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Cable Segment #${seg.segmentNumber || '?'}</h3>
      <table style="width:100%; font-size: 12px; border-collapse: collapse;">
        <tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${seg.length ? seg.length.toFixed(2) + ' m' : 'N/A'}</td></tr>
        <tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${seg.cableType || route.cableType || 'N/A'}</td></tr>
        <tr><td style="padding: 2px 4px; color: #666;">Fiber Count</td><td style="padding: 2px 4px; font-weight: 500;">${seg.fiberCount || '?'}F</td></tr>
        <tr><td style="padding: 2px 4px; color: #666;">Route</td><td style="padding: 2px 4px; font-weight: 500;">${route.name || 'N/A'}</td></tr>
      </table>
      ${slackBtn}
    </div>`;
}

export function getRoutePopupHtml(route: any): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 Route: ${route.name}</h3><p style="font-size: 12px; color: #666;">Length: ${route.routeLength ? route.routeLength.toFixed(2) + ' m' : 'N/A'}</p></div>`;
}

export function getGeoJsonCablePopupHtml(route: any, layerName: string): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🔌 ${route.name} (GeoJSON)</h3><p style="font-size: 12px; color: #666;">Layer: ${layerName || 'CABLE'}</p></div>`;
}

export function getGeoJsonPointPopupHtml(label: string, pointCoords: [number, number]): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📍 ${label}</h3><p style="font-size: 12px; color: #666;">GPS: ${pointCoords[1].toFixed(6)}, ${pointCoords[0].toFixed(6)}</p></div>`;
}

export function getPolePopupHtml(pole: any, lat: number, lng: number): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📡 Pole #${pole.poleNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType || 'CONCRETE'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height || 9}m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${pole.status || 'PLANNED'}</td></tr></table></div>`;
}

export function getClosurePopupHtml(closure: any, lat: number, lng: number, titleText: string, dpName: string): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">${titleText}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse; margin-bottom: 8px;">${dpName ? `<tr><td style="padding: 2px 4px; color: #666;">Name</td><td style="padding: 2px 4px; font-weight: 500;">${dpName}</td></tr>` : ''}<tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${closure.closureType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${closure.capacity || '?'}</td></tr><tr><td style="padding: 2px 4px; color: #666; max-width: 150px; word-break: break-word;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${closure.notes || '-'}</td></tr></table></div>`;
}

export function getChamberPopupHtml(ch: any, lat: number, lng: number): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">⚫ Chamber #${ch.chamberNumber || '?'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${ch.chamberType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${ch.status || 'PLANNED'}</td></tr><tr><td style="padding: 2px 4px; color: #666; max-width: 150px; word-break: break-word;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${ch.notes || '-'}</td></tr></table></div>`;
}

export function getRoadPopupHtml(road: any): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">🛣️ ${road.roadName || 'Road Segment'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${road.length ? road.length.toFixed(2) + ' m' : 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Authority</td><td style="padding: 2px 4px; font-weight: 500;">${road.authority || road.roadType || 'N/A'}</td></tr></table></div>`;
}

export function getAssetPopupHtml(asset: any, lat: number, lng: number): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600;">📍 ${asset.assetName || asset.assetCode || 'Asset'}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse;"><tr><td style="padding: 2px 4px; color: #666;">Code</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetCode || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${asset.assetType || 'N/A'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">GPS</td><td style="padding: 2px 4px; font-weight: 500;">${lat.toFixed(6)}, ${lng.toFixed(6)}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Status</td><td style="padding: 2px 4px; font-weight: 500;">${asset.status || 'ACTIVE'}</td></tr></table></div>`;
}

export function getPlannedFeedPointPopupHtml(cl: any): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #10b981;">📍 Feed Point (Root Node)</h3><p style="font-size: 12px; margin: 0 0 8px;">This Manhole/Cabinet is the origin of the distribution layout.</p><button onclick="window.startEditClosure(${cl.index})" style="width: 100%; background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">✏️ Edit Details</button></div>`;
}

export function getPlannedClosurePopupHtml(cl: any, icon: string, isFDP: boolean): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 ${icon} ${isFDP ? 'Planned FDP' : 'Junction Joint'} #${cl.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse; margin-bottom: 8px;"><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${cl.closureType}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Capacity</td><td style="padding: 2px 4px; font-weight: 500;">${cl.capacity}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Notes</td><td style="padding: 2px 4px; font-weight: 500;">${cl.notes || '-'}</td></tr></table><button onclick="window.startEditClosure(${cl.index})" style="width: 100%; background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">✏️ Edit Details</button></div>`;
}

export function getPlannedPolePopupHtml(pole: any): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 📡 Planned Pole #${pole.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse; margin-bottom: 8px;"><tr><td style="padding: 2px 4px; color: #666;">Height</td><td style="padding: 2px 4px; font-weight: 500;">${pole.height}m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${pole.poleType}</td></tr></table><button onclick="window.startEditPole(${pole.index})" style="width: 100%; background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">✏️ Edit Details</button></div>`;
}

export function getPlannedCablePopupHtml(cable: any): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">🤖 🔌 Planned Cable #${cable.index}</h3><table style="width:100%; font-size: 12px; border-collapse: collapse; margin-bottom: 8px;"><tr><td style="padding: 2px 4px; color: #666;">Length</td><td style="padding: 2px 4px; font-weight: 500;">${cable.length.toFixed(2)} m</td></tr><tr><td style="padding: 2px 4px; color: #666;">Type</td><td style="padding: 2px 4px; font-weight: 500;">${cable.cableType || 'ADSS'}</td></tr><tr><td style="padding: 2px 4px; color: #666;">Fiber Count</td><td style="padding: 2px 4px; font-weight: 500;">${cable.fiberCount}F</td></tr></table><button onclick="window.startEditCable(${cable.index})" style="width: 100%; background: #2563eb; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; margin-bottom: 6px;">✏️ Edit Details</button><button onclick="window.addSlackLoopToDraftSegment(${cable.index})" style="width: 100%; background: #f97316; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;">➕ Add Tension Slack Loop (+20m)</button></div>`;
}

export function getSelectedFeedPointPopupHtml(): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #10b981;">📍 Selected Feed Point</h3><p style="font-size: 12px; margin: 0;">This point (Manhole/Cabinet) will be used as the root for all planned cable paths.</p></div>`;
}

export function getPinnedStartDevicePopupHtml(): string {
  return `<div style="font-family: sans-serif; min-width: 200px;"><h3 style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #f97316;">📍 Pinned Start Device</h3><p style="font-size: 12px; margin: 0;">This custom location will be used as the origin/start device for the new layout.</p></div>`;
}
