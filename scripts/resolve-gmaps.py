import urllib.request
import re

url = "https://maps.app.goo.gl/H2BQWHVNE9m8wJFM7?g_st=ic"
req = urllib.request.Request(
    url, 
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
)
try:
    with urllib.request.urlopen(req) as response:
        final_url = response.geturl()
        print("Final URL:", final_url)
        # Search for coordinates in the URL
        match = re.search(r'@([0-9.-]+),([0-9.-]+)', final_url)
        if match:
            print("Coords:", match.group(1), match.group(2))
        else:
            # Check query params
            print("No coords in URL, reading content...")
            html = response.read().decode('utf-8')
            meta = re.search(r'meta content="https://maps.google.com/\?q=([0-9.-]+),([0-9.-]+)', html)
            if meta:
                print("Coords from meta:", meta.group(1), meta.group(2))
            else:
                # Try finding any ll parameter
                ll_match = re.search(r'll=([0-9.-]+),([0-9.-]+)', html)
                if ll_match:
                    print("Coords from ll:", ll_match.group(1), ll_match.group(2))
except Exception as e:
    print("Error:", e)
