import express, { response } from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '@config/common_config';
import crypto from 'crypto'; // Include crypto module for hashing
import { FileExistenceResponse } from 'src/common/common-model';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { EventEmitter } from 'stream';

const app: express.Application = express();
const port: number = 3000;
interface CheckSumHashTable {
    [key: string]: boolean;
}

const cors = require('cors');
app.use(cors());

// Multer config for file upload
const storage: multer.StorageEngine = multer.diskStorage({
    // A string or function that determines the destination path for uploaded files
    destination: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        cb(null, uploadsDir)
    },
    // A string or function that determines file name
    filename: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        // cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname))
        cb(null, file.originalname)  // Use original file name
    }
});
const upload: multer.Multer = multer({ storage: storage });

let existingHashes: CheckSumHashTable = {};  // This now explicitly tells TypeScript the structure of existingHashes
let availableUts: Array<string> = ["192.168.100.64", "192.168.100.65"];

// Middleware
app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({
//     extended: true,
// }));
app.use(express.static(path.join(__dirname, 'src')));

// Check if the uploads directory exists, and create it if it doesn’t
const uploadsDir: string = path.join(__dirname, CONFIG.storagePaths.upload);
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Read all files and calculate their hashes on startup
fs.readdir(uploadsDir, async (err, files) => {
    if (err) {
        return console.error("Failed to list directory", err);
    }
    for (let file of files) {
        const filePath = path.join(uploadsDir, file);
        const fileHash = await calculateHash(filePath);
        existingHashes[fileHash] = true;
    }
});

// Check files exists request
app.post(CONFIG.apiPaths.checkFileExists, (req, res) => {
    const { hash } = req.body;

    //Sanity check
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
        return res.status(400).json({ error: "Invalid hash format" });
    }

    const fileExists = existingHashes[hash] === true;
    return res.status(200).json({ exists: fileExists } as FileExistenceResponse);
});

// Upload files request
app.post(CONFIG.apiPaths.uploadFile, upload.single('file'), async (req, res) => {
    if (req.file) {
        const fileHash = await calculateHash(req.file.path);
        existingHashes[fileHash] = true; // Update hash table with new file's hash
        res.json({ message: `File uploaded successfully: ${req.file.path}` });
    }
});

// Function to calculate hash of file content
function calculateHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('error', err => reject(err));
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

// Get files request
app.get(CONFIG.apiPaths.getExistingFileNames, (req: express.Request, res: express.Response) => {
    fs.readdir(uploadsDir, (err: NodeJS.ErrnoException | null, file_names: string[]) => {
        console.log(file_names.length)
        if (err) {
            res.status(500).send('Error retrieving file list');
            return;
        }

        return res.json(file_names);
    });
});

// Get available uts request
app.get(CONFIG.apiPaths.getAvailableUts, (req: express.Request, res: express.Response) => {
    return res.json(availableUts)
});

app.get(CONFIG.apiPaths.installFile, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendEventResponse = (data: any, eventName: string | null = null) => {
        // Warning: The format should be fixed, read SSE events for details
        if (eventName) {
            res.write(`event: ${eventName}\n`);
        }
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
        const utIp = req.query[CONFIG.requestObjectKeys.utIpAddress] as string;
        const fileName = req.query[CONFIG.requestObjectKeys.installFileName] as string;
        const filePath = path.join(uploadsDir, fileName);
        const pythonProcess: ChildProcessWithoutNullStreams = spawn('python3', ['src/installer/test_install_sw.py',
            '-path', filePath, '-ip', utIp]);

        pythonProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            console.log(output);
            sendEventResponse(output);
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
            const error = data.toString(); 
            sendEventResponse(error, CONFIG.serverMessageVars.errorEvent);
        });

        pythonProcess.on('close', (code: number) => {
            console.log(`Python script completed with code ${code}.`);
            sendEventResponse("Complete", CONFIG.serverMessageVars.completeEvent)
        });
    } catch (error) {
        console.log(`Catched unexpected error ${error}`);
    }
});


app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

