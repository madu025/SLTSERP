const http = require('http');

function checkServer() {
  const req = http.get('http://localhost:3000/api/health', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('SERVER_STATUS=OK');
      console.log('HTTP_CODE=' + res.statusCode);
      console.log('BODY=' + data);
    });
  });
  req.on('error', (e) => {
    console.log('SERVER_STATUS=NOT_RUNNING');
    console.log('ERROR=' + e.message);
  });
  req.setTimeout(5000, () => {
    req.destroy();
    console.log('SERVER_STATUS=TIMEOUT');
  });
}

checkServer();
