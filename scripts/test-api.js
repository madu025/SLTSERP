const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/service-orders?filter=completed&limit=200',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': '019fc74b-0000-0000-0000-000000000001',
    'x-user-role': 'SUPER_ADMIN'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('Status:', res.statusCode);
      console.log('Keys:', Object.keys(json));
      console.log('Items count:', json.items?.length);
      console.log('Meta:', JSON.stringify(json.meta));
      console.log('Summary keys:', json.summary ? Object.keys(json.summary) : 'none');
      
      if (json.items && json.items.length > 0) {
        console.log('\nFirst item keys:', Object.keys(json.items[0]));
        console.log('First item soNum:', json.items[0].soNum);
        console.log('First item sltsStatus:', json.items[0].sltsStatus);
        console.log('First item isInvoicable:', json.items[0].isInvoicable);
        console.log('First item invoiced:', json.items[0].invoiced);
        console.log('First item contractorId:', json.items[0].contractorId);
        console.log('First item contractor:', JSON.stringify(json.items[0].contractor));
      }
    } catch (e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', data.slice(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
