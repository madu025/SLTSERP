import json
import subprocess

def main():
    cmd = [
        "docker", "exec", "qfieldcloud-db-1", "psql", "-U", "qfieldcloud_db_admin", "-d", "qfieldcloud_db", "-t", "-c",
        "SELECT feedback FROM core_job WHERE type='package' AND project_id='bb3897b5-b4ae-4720-9f62-5e2041c28f20' ORDER BY created_at DESC LIMIT 1;"
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0:
        try:
            fb = json.loads(res.stdout.strip())
            print(json.dumps(fb, indent=2))
        except Exception as e:
            print("Failed to parse JSON:", e)
            print("Raw:", res.stdout[:500])
    else:
        print("Failed to run command:", res.stderr)

if __name__ == '__main__':
    main()
