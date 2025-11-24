const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const mime = require('mime-types');
const os = require('os');

const app = express();
const PORT = 80; // Changed from 3000 to 80 for direct IP access

const TARGET_ROOT = 'D:\\CDZ';

// Ensure the directory exists
if (!fs.existsSync(TARGET_ROOT)) {
    try {
        fs.mkdirSync(TARGET_ROOT, { recursive: true });
        console.log(`Created root directory: ${TARGET_ROOT}`);
    } catch (e) {
        console.error(`Could not create root directory ${TARGET_ROOT}. Please ensure it exists or change the path in server.js.`);
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to get local IP for LAN access
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Middleware to validate path traversal
const validatePath = (req, res, next) => {
    const reqPath = req.query.path || req.body.path || '';
    const fullPath = path.resolve(TARGET_ROOT, reqPath);

    if (!fullPath.startsWith(path.resolve(TARGET_ROOT))) {
        return res.status(403).json({ error: 'Access denied: Path traversal detected.' });
    }
    req.fullPath = fullPath;
    next();
};

// API: List Files
app.get('/api/files', validatePath, (req, res) => {
    // Check if directory exists, if not create it
    if (!fs.existsSync(req.fullPath)) {
        try {
            fs.mkdirSync(req.fullPath, { recursive: true });
        } catch (err) {
            return res.status(500).json({ error: 'Unable to create directory: ' + err.message });
        }
    }

    fs.readdir(req.fullPath, { withFileTypes: true }, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to scan directory: ' + err.message });
        }

        const fileList = files.map(file => {
            return {
                name: file.name,
                isDirectory: file.isDirectory(),
                size: 0,
                path: path.relative(TARGET_ROOT, path.join(req.fullPath, file.name)).replace(/\\/g, '/')
            };
        });

        res.json({
            currentPath: path.relative(TARGET_ROOT, req.fullPath).replace(/\\/g, '/'),
            files: fileList
        });
    });
});

// API: Get File Content (for viewing/downloading)
app.get('/api/download', validatePath, (req, res) => {
    res.download(req.fullPath);
});

// API: View File Content (inline)
app.get('/api/view', validatePath, (req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.sendFile(req.fullPath);
});

// API: Create Folder
app.post('/api/folder', validatePath, (req, res) => {
    const folderName = req.body.name;
    if (!folderName) return res.status(400).json({ error: 'Folder name required' });

    const newFolderPath = path.join(req.fullPath, folderName);

    fs.mkdir(newFolderPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API: Delete File/Folder
app.delete('/api/delete', validatePath, (req, res) => {
    fs.stat(req.fullPath, (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });

        if (stats.isDirectory()) {
            fs.rm(req.fullPath, { recursive: true, force: true }, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        } else {
            fs.unlink(req.fullPath, (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
        }
    });
});

// API: Rename File/Folder
app.post('/api/rename', validatePath, (req, res) => {
    const { newName } = req.body;
    if (!newName) return res.status(400).json({ error: 'New name required' });

    const oldPath = req.fullPath;
    const newPath = path.join(path.dirname(oldPath), newName);

    if (!newPath.startsWith(path.resolve(TARGET_ROOT))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    fs.rename(oldPath, newPath, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API: Upload File
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.resolve(TARGET_ROOT, req.query.path || '');
        if (!uploadPath.startsWith(path.resolve(TARGET_ROOT))) {
            return cb(new Error('Access denied'));
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

app.post('/api/upload', upload.single('file'), (req, res) => {
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Web OS Server running at http://localhost:${PORT}`);
    console.log(`LAN Access: http://${getLocalIP()}${PORT === 80 ? '' : ':' + PORT}`);
    console.log(`Serving files from: ${TARGET_ROOT}`);
    if (PORT === 80) {
        console.log('\nNote: Running on port 80 requires administrator privileges on Windows.');
        console.log('If you get an EACCES error, run as administrator or use port 3000 instead.');
    }
});
