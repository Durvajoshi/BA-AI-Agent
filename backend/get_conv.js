const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({ user: 'postgres', host: 'localhost', database: 'ai_ba_agent', password: 'seaneb2212', port: 5432 });

pool.query(`SELECT ba_output FROM ba_versions WHERE conversation_id = 'ded8576d-ec76-49dd-9b69-3d12f6b4c39b' ORDER BY id DESC LIMIT 1`, (err, res) => {
    if (err) console.error(err);
    else if (res.rows.length) fs.writeFileSync('temp_conv.json', JSON.stringify(res.rows[0], null, 2));
    else console.log('not found');
    pool.end();
});
