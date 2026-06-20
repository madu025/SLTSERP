import json
with open('tmp_feedback_v3.json', 'r') as f:
    fb = json.load(f)
print("Status:", fb.get('status'))
outputs = fb.get('feedback', {}).get('outputs', {})
if 'qgis_layers_data' in outputs:
    print("--- QGIS Layers Data ---")
    layers = outputs['qgis_layers_data'].get('layers_by_id', {})
    for lid, ldata in layers.items():
        if ldata.get('name', '').startswith('SLT_'):
            print(f"Layer: {ldata.get('name')}")
            print(f"  valid: {ldata.get('is_valid')}")
            print(f"  error: {ldata.get('error_code')}")
            print(f"  datasource: {ldata.get('datasource')}")
            print(f"  action: {ldata.get('qfs_action')}")
            print("-" * 50)
