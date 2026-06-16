async function test() {
  const headers = {
    'x-user-id': 'admin',
    'x-user-role': 'SUPER_ADMIN'
  };

  try {
    const res = await fetch('http://localhost:3000/api/contractors?page=1&limit=5', { headers });
    const data = await res.json();
    console.log("Full Object:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Fetch Error:", e);
  }
}

test();
