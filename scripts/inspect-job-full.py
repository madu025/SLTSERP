import json

with open('tmp_feedback_v3.json', 'r') as f:
    job = json.load(f)

# Find all instances of layers in the feedback structure
feedback = job.get('feedback', {})
outputs = feedback.get('outputs', {})

def find_layer_details(data, search_name):
    found = []
    if isinstance(data, dict):
        if 'name' in data and data['name'] == search_name:
            found.append(data)
        for k, v in data.items():
            found.extend(find_layer_details(v, search_name))
    elif isinstance(data, list):
        for item in data:
            found.extend(find_layer_details(item, search_name))
    return found

print("\nLayer configurations for SLT_Poles:")
poles_info = find_layer_details(outputs, "SLT_Poles")
for info in poles_info:
    print(json.dumps(info, indent=2))
    print("-" * 50)
    
print("\nLayer configurations for SLT_Cables:")
cables_info = find_layer_details(outputs, "SLT_Cables")
for info in cables_info:
    print(json.dumps(info, indent=2))
    print("-" * 50)
