import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '@common/common_config';
import { UTInfo, EUtStatus } from '@common/common-model'
import crypto from 'crypto'; // Include crypto module for hashing
import { FileExistenceResponse } from 'src/common/common-model';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

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
let availableUts: Array<string> = ["192.168.100.64", "192.168.100.65", "192.168.100.66", "192.168.100.67"];
let utInfosByIp: { [ip: string]: UTInfo } = {};
availableUts.forEach(ip => {
    utInfosByIp[ip] = { ip, status: EUtStatus.Idle };
});

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

app.get(CONFIG.apiPaths.installFile, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const utIp = req.query[CONFIG.requestObjectKeys.utIpAddress] as string;
        const fileName = req.query[CONFIG.requestObjectKeys.installFileName] as string;
        utInfosByIp[utIp].status = EUtStatus.Installing;
        let currentError:any = null
        const pythonProcess: ChildProcessWithoutNullStreams = spawn('python3', ['src/installer/test_install_sw.py',
            '-path', path.join(uploadsDir, fileName), '-ip', utIp]);
        
        pythonProcess.stdout.on('data', (data: Buffer) => {
            const output = data.toString();
            console.log(output);
            sendEventResponse(output);
        });
        
        pythonProcess.stderr.on('data', (data: Buffer) => {
            currentError = data.toString();
            utInfosByIp[utIp].status = EUtStatus.Error;
            sendEventResponse(`Complete install -> Failed. Error = ${currentError}`, CONFIG.serverMessageVars.errorEvent)
        });

        pythonProcess.on('close', (code: number) => {
            console.log(`Python script completed with code ${code}.`);
            if (code == 0) {
                utInfosByIp[utIp].status = EUtStatus.Idle;
                sendEventResponse(`Complete install -> Success`, CONFIG.serverMessageVars.completeEvent)
            } else if (currentError == null) { //Haven't handle
                utInfosByIp[utIp].status = EUtStatus.Error;
                sendEventResponse(`Complete install -> Failed. Unknown error!`, CONFIG.serverMessageVars.errorEvent)
            }
        });
    } catch (error) {
        console.log(`Catched unexpected error ${error}`);
    }

    const sendEventResponse = (data: any, eventName: string | null = null) => {
        // Warning: The format should be fixed, read SSE events for details
        if (eventName) {
            res.write(`event: ${eventName}\n`);
        }
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
});

app.get(CONFIG.apiPaths.getUtsInfos, (req, res) => {
    res.json(utInfosByIp);
});

app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

