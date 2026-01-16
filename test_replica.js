const { Client } = require('pg');
const client = new Client({
    connectionString: "postgresql://postgres.xhhbwywbnktwkbjijzxi:@Maduranga89@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
});
client.connect()
    .then(() => {
        console.log('Connected successfully');
        return client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    })
    .then(res => {
        console.log('Tables:', res.rows.map(r => r.table_name));
        process.exit(0);
    })
    .catch(err => {
        console.error('Connection error', err.stack);
        process.exit(1);
    });
