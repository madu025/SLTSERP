import http from 'http';

http.get('http://localhost:3000/api/health', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('SERVER STATUS:', res.statusCode);
    console.log('RESPONSE:', data);
  });
}).on('error', e => {
  console.log('SERVER NOT RUNNING:', e.message);
  process.exit(1);
});
