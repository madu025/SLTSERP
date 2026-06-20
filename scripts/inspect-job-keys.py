import json

with open('tmp_feedback_v3.json', 'r') as f:
    job = json.load(f)
    
print("Job Keys:", list(job.keys()))
print("Status:", job.get('status'))
feedback = job.get('feedback', {})
print("Feedback Keys:", list(feedback.keys()) if isinstance(feedback, dict) else type(feedback))
if isinstance(feedback, dict):
    print("Feedback outputs keys:", list(feedback.get('outputs', {}).keys()))
    print("Feedback logs keys:", list(feedback.get('logs', {}).keys()))
    
    # Dump a snippet of feedback
    print("\nFeedback snippet:")
    print(json.dumps(feedback, indent=2)[:2000])
