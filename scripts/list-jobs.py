import json
import urllib.request
import os

base_url = 'http://localhost:8011'
username = 'admin'
password = 'admin123'

# Login
url = f"{base_url}/api/v1/auth/login/"
data = json.dumps({"username": username, "password": password}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
with urllib.request.urlopen(req) as response:
    token = json.loads(response.read().decode())['token']

project_id = '609ad921-9203-42de-9577-aaaa2179a20b'
print(f"Listing all files for project {project_id}:")

url = f"{base_url}/api/v1/files/{project_id}/"
req = urllib.request.Request(url, headers={"Authorization": f"Token {token}"})
with urllib.request.urlopen(req) as response:
    files = json.loads(response.read().decode())

for f in files:
    print(f"Name: {f['name']} | Size: {f['size']} bytes | MD5: {f['md5']}")
