import json

with open('tmp_feedback_v2.json', 'r') as f:
    fb = json.load(f)
    
layers = fb['outputs']['qfield_layer_data']['layers_by_id']
for lid, ldata in layers.items():
    if ldata.get('name', '').startswith('SLT_'):
        print(f"Layer: {ldata.get('name')} -> qfs_action: {ldata.get('qfs_action')}")
