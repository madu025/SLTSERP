import os
import requests

baseUrl = os.getenv('NEXT_PUBLIC_QFIELD_API_URL') or 'http://localhost:8100'
qfield_project_id = '7a55babe-8909-4554-8dd7-9bc03f7a1b9b'

username = os.getenv('QFIELD_ADMIN_USER') or 'admin'
password = os.getenv('QFIELD_ADMIN_PASS') or 'admin'

print("Connecting to QFieldCloud...")
res = requests.post(f"{baseUrl}/api/v1/auth/login/", json={"username": username, "password": password})
if not res.ok:
    print(f"Auth failed: {res.status_code} - {res.text}")
    exit(1)

token = res.json().get('token') or res.json().get('access_token')
headers = {"Authorization": f"Token {token}"}

print(f"Fetching project details for {qfield_project_id}...")
p_res = requests.get(f"{baseUrl}/api/v1/projects/{qfield_project_id}/", headers=headers)
if p_res.ok:
    print("Project Details:", p_res.json())
else:
    print(f"Project fetch failed: {p_res.status_code}")

print(f"\nFetching deltas for project {qfield_project_id}...")
d_res = requests.get(f"{baseUrl}/api/v1/deltas/{qfield_project_id}/", headers=headers)
if d_res.ok:
    deltas = d_res.json()
    # Check if results key exists
    if isinstance(deltas, dict) and 'results' in deltas:
        deltas = deltas['results']
        
    print(f"Total deltas found: {len(deltas)}")
    for idx, d in enumerate(deltas):
        print(f"\nDelta {idx + 1}:")
        print(f"  ID: {d.get('id')}")
        print(f"  Status: {d.get('status')}")
        print(f"  Last Status: {d.get('last_status')}")
        print(f"  Created At: {d.get('created_at')}")
        print(f"  Content: {d.get('content')}")
else:
    print(f"Deltas fetch failed: {d_res.status_code} - {d_res.text}")
