import os
import json

def empty_templates():
    geo_json_dir = 'QGIS Project Template/GeoJSON'
    if not os.path.exists(geo_json_dir):
        print("Directory not found.")
        return

    files = os.listdir(geo_json_dir)
    for file in files:
        if file.endswith('.geojson'):
            file_path = os.path.join(geo_json_dir, file)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check features count
                old_count = len(data.get('features', []))
                
                # Empty features
                data['features'] = []
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=2)
                
                print(f"Emptied {file}: removed {old_count} mock features.")
            except Exception as e:
                print(f"Failed to empty {file}: {e}")

empty_templates()
