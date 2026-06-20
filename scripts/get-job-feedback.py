import json
import urllib.request
import urllib.parse
import os
import sys

# Get env variables
base_url = os.environ.get('NEXT_PUBLIC_QFIELD_API_URL', 'http://localhost:8011')
username = os.environ.get('QFIELD_ADMIN_USER', 'admin')
password = os.environ.get('QFIELD_ADMIN_PASS', 'admin123')

# Authenticate
print(f"Authenticating as {username}...")
url = f"{base_url}/api/v1/auth/login/"
data = json.dumps({"username": username, "password": password}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        res_data = json.loads(response.read().decode())
        token = res_data.get('token') or res_data.get('access_token')
except Exception as e:
    print(f"Authentication failed: {e}")
    sys.exit(1)

# We want to check the latest job for our project
project_id = 'bba24532-a829-43e1-8f60-75487a37803b'
print(f"Fetching latest package job for project: {project_id}")

url = f"{base_url}/api/v1/jobs/?project_id={project_id}&type=package"
req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})

try:
    with urllib.request.urlopen(req) as response:
        jobs = json.loads(response.read().decode())
except Exception as e:
    print(f"Failed to fetch jobs: {e}")
    sys.exit(1)

package_jobs = [j for j in jobs if j.get('type') == 'package']
if not package_jobs:
    print("No package jobs found.")
    sys.exit(0)

# Sort by created_at desc (latest first)
package_jobs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
latest_job_id = package_jobs[0]['id']
print(f"Fetching detailed job info for package job ID: {latest_job_id}")

url = f"{base_url}/api/v1/jobs/{latest_job_id}/"
req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})

try:
    with urllib.request.urlopen(req) as response:
        detailed_job = json.loads(response.read().decode())
except Exception as e:
    print(f"Failed to fetch job details: {e}")
    sys.exit(1)

# Print feedback
feedback = detailed_job.get('feedback', {})
with open('tmp_feedback_v3.json', 'w') as f:
    json.dump(detailed_job, f, indent=2)
print("Saved feedback to tmp_feedback_v3.json")

# Print layer feedback summary
if 'outputs' in feedback and 'qfield_layer_data' in feedback['outputs']:
    layers = feedback['outputs']['qfield_layer_data'].get('layers_by_id', {})
    print("\n--- Packaged Layers Config ---")
    for lid, ldata in layers.items():
        if ldata.get('name', '').startswith('SLT_'):
            print(f"Layer: {ldata.get('name')}")
            print(f"  - Action: {ldata.get('qfs_action')}")
            print(f"  - Cloud Action: {ldata.get('qfs_cloud_action')}")
            print(f"  - Source: {ldata.get('source')}")
            print(f"  - Read-Only: {ldata.get('readonly')}")
            print(f"  - Valid: {ldata.get('valid')}")
            print("-" * 50)
else:
    print("No qfield_layer_data feedback available in the job.")
