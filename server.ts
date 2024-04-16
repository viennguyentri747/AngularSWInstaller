import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '@config/common_config';

const app: express.Application = express();
const port: number = 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'src')));

// Check if the uploads directory exists, and create it if it doesn’t
const uploadsDir: string = path.join(__dirname, CONFIG.storagePaths.upload);
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for file upload
const storage: multer.StorageEngine = multer.diskStorage({
    // A string or function that determines the destination path for uploaded files
    destination: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        cb(null, uploadsDir)
    },
    // A string or function that determines file name
    filename: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
    }
});
const upload: multer.Multer = multer({ storage: storage });

// Routes
app.post(CONFIG.apiPaths.uploadFileUrl, upload.single('file'), (req, res) => {
    //response with json path
    res.json({ message: `File uploaded successfully: ${req.file?.path}` });
});

app.get(CONFIG.apiPaths.readFilesUrl, (req: express.Request, res: express.Response) => {
    fs.readdir(uploadsDir, (err: NodeJS.ErrnoException | null, files: string[]) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error retrieving file list');
            return;
        }
        res.json(files);
    });
});

app.post(CONFIG.apiPaths.installFileUrl, (req, res) => {
    const { filename } = req.body;
    const sourcePath = path.join(uploadsDir, filename);
    // const destinationPath = path.join(installDir, filename);

    // // Check if source file exists
    // if (!fs.existsSync(sourcePath)) {
    //     return res.status(404).send("File not found.");
    // }

    // // Move the file from uploads to installation directory
    // fs.rename(sourcePath, destinationPath, (err) => {
    //     if (err) {
    //         console.error("Error installing file:", err);
    //         return res.status(500).send("Error installing file.");
    //     }
    //     res.send("File installed successfully.");
    // });
});

app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
