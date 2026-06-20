import json
with open('tmp_feedback_v3.json', 'r') as f:
    fb = json.load(f)
steps = fb.get('feedback', {}).get('steps', [])
for s in steps:
    print(f"Step ID: {s.get('id')} | Name: {s.get('name')}")
    returns = s.get('returns', {})
    if returns:
        print("  Returns keys:", list(returns.keys()))
        for k in ['log', 'error_summary', 'error_message', 'container_exit_code']:
            if k in returns:
                print(f"  {k}: {returns[k]}")
