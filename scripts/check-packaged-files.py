import json

with open('tmp_feedback_v2.json', 'r') as f:
    fb = json.load(f)
    
outputs = fb.get('outputs', {})
package_project = outputs.get('package_project', {})
print("Package project keys:", list(package_project.keys()))

# Let's print the files uploaded in upload_packaged_project
upload_packaged_project = outputs.get('upload_packaged_project', {})
print("Upload packaged project keys:", list(upload_packaged_project.keys()))

# Let's search for packaged files in the feedback
import re
print("\nSearching feedback for filenames:")
for key, val in outputs.items():
    if isinstance(val, dict):
        if 'files' in val:
            print(f"Key '{key}' has files:")
            for file_info in val['files']:
                print(f"  {file_info.get('name')} ({file_info.get('size')} bytes)")
