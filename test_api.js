const http = require('http');

const get = (path) => {
    http.get(`http://localhost/api/files?path=${encodeURIComponent(path)}`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            console.log(`Path: "${path}"`);
            console.log('Status:', res.statusCode);
            console.log('Body:', data);
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
};

get('');
get('5分钟');
