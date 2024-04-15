const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');
// const fs = require('fs');


const app = express();
const port = 3000;
const upload_storage_rel_path = 'storage/upload'

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'src')));

// Check if the uploads directory exists, and create it if it doesn’t
const uploadsDir = path.join(__dirname, upload_storage_rel_path);  // Set the path to the uploads directory
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });  // Using { recursive: true } to ensure the directory is created
}

// Multer config for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, upload_storage_rel_path)
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// Routes
app.post('/upload', upload.single('file'), (req, res) => {
    res.send(`File uploaded successfully: ${req.file.path}`);
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'scr/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
