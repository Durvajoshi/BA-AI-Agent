const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'ai_ba_agent', password: 'seaneb2212', port: 5432 });

pool.query(`SELECT ba_output FROM ba_versions WHERE ba_output->>'title' LIKE '%AI%' ORDER BY id DESC LIMIT 1`, (err, res) => {
    if (err) console.error(err);
    else if (res.rows.length) fs.writeFileSync('temp_aipowe.json', JSON.stringify(res.rows[0], null, 2));
    else console.log('not found');
    pool.end();
});
