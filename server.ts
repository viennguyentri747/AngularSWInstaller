import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { CONFIG, SERVER_CONFIG } from '@common/common_config';
import { GetFileVersion, IsFileOkToInstall } from 'src/common/common-functions';
import { UTInfo, EUtStatus, InstallFileInfo } from '@common/common-model'
import crypto from 'crypto'; // Include crypto module for hashing\
import { FileExistenceResponse, InstallFilesResponse, UTInfosResponse } from 'src/common/common-response';
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
let availableUts: Array<string> = ["192.168.100.64", "192.168.100.65", "172.16.20.97", "192.168.100.67", "192.168.100.1"];
let utInfosByIp: { [ip: string]: UTInfo } = {};
availableUts.forEach(ip => {
    utInfosByIp[ip] = { ip: ip, status: EUtStatus.Idle };
});
let fileInfos: Array<InstallFileInfo> = []

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

// Read all files to init data (existing hashes, fileInfos) on startup
reloadFilesData();
function reloadFilesData(): void {
    fs.readdir(uploadsDir, async (err, fileNames) => {
        if (err) {
            return console.error("Failed to list directory", err);
        }

        fileInfos = [];
        for (let fileName of fileNames) {
            const filePath = path.join(uploadsDir, fileName);

            const fileHash = await calculateHash(filePath);
            existingHashes[fileHash] = true;

            // TODO: fetch latest version from GITLAB
            addNewFileInfo(fileName)
        }
    });
}

// Check files exists request
app.post(CONFIG.apiPaths.checkFileExists, (req, res) => {
    const { hash } = req.body;

    //Sanity check
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
        // Usage:
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
            return sendErrRequestResponse(res, SERVER_CONFIG.status_code.badRequest, "Invalid hash format");
        }
    }

    const fileExists = existingHashes[hash] === true;
    return res.json({ exists: fileExists } as FileExistenceResponse);
});

// Upload files request
app.post(CONFIG.apiPaths.uploadFile, upload.single('file'), async (req, res) => {
    if (req.file) {
        const fileHash = await calculateHash(req.file.path);
        existingHashes[fileHash] = true; // Update hash table with new file's hash
        addNewFileInfo(req.file.filename)
        res.json({ message: `File uploaded successfully: ${req.file.path}` });
    }
});

function addNewFileInfo(fileName: string): void {
    const fileVersion = GetFileVersion(fileName)
    const isLatestVersion = fileVersion == CONFIG.installerVersion.latest
    const fileInfo: InstallFileInfo = {
        fileName: fileName,
        version: fileVersion,
        isLatestVersion: isLatestVersion
    };
    fileInfos.push(fileInfo);
}

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

// Get file infos request
app.get(CONFIG.apiPaths.getExistingFileInfos, (req: express.Request, res: express.Response) => {
    res.json({ fileInfos: fileInfos } as InstallFilesResponse);
});

app.get(CONFIG.apiPaths.installFile, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const utIp = req.query[CONFIG.requestObjectKeys.utIpAddress] as string;
        const fileName = req.query[CONFIG.requestObjectKeys.installFileName] as string;
        const fileInfo = fileInfos.find(file => file.fileName === fileName);
        if (!fileInfo) {
            throw new Error("No file info");
        }

        if (!IsFileOkToInstall(fileInfo.fileName)) {
            throw new Error("File is not ok to install");
        }

        utInfosByIp[utIp].status = EUtStatus.Installing;
        // Run install script
        const pythonProcess: ChildProcessWithoutNullStreams = spawn('python3', ['src/installer/test_install_sw.py',
            '-path', path.join(uploadsDir, fileName), '-ip', utIp, '-version', fileInfo.version]);
        let latestLog: string = "";

        pythonProcess.stdout.on('data', (data: Buffer) => {
            const fullMsg = data.toString();
            latestLog = fullMsg;
            console.log(fullMsg);
            sendEventResponse(fullMsg);
        });

        pythonProcess.stderr.on('data', (data: Buffer) => {
            const error = data.toString();
            console.log(`Latest error: ${error}`);
        });

        //On process completed (can be error/no error)
        pythonProcess.on('close', (code: number) => {
            console.log(`Python script completed with code ${code}.`);
            const isInstallSuccess: boolean = (code == 0);
            utInfosByIp[utIp].status = isInstallSuccess ? EUtStatus.Idle : EUtStatus.Error;
            if (isInstallSuccess) {
                sendEventResponse(`Install Succeeded!`, CONFIG.serverMessageVars.completeEvent);
            } else {
                sendEventResponse(`Install Failed. Latest log = ${latestLog}`, CONFIG.serverMessageVars.completeEvent);
            }
        });

    } catch (error) {
        console.log(`Caught unexpected error ${error}`);
        sendErrRequestResponse(res, SERVER_CONFIG.status_code.internalServerError, "Invalid hash format");
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
    res.json({ utInfosByIp: utInfosByIp } as UTInfosResponse);
});

app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

function sendErrRequestResponse(res: express.Response, errorCode: number, errorMessage: string): express.Response {
    return res.status(errorCode).json({ error: errorMessage });
}
