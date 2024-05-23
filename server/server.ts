import express from 'express';
import multer from 'multer';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { CONFIG, SERVER_CONFIG } from '@common/common_config';
import { GetFileVersion, IsFileOkToInstall, CompareVersions } from 'src/common/common-functions';
import { UTInfo, EUtStatus, InstallFileInfo } from '@common/common-model'
import crypto from 'crypto'; // Include crypto module for hashing\
import { CancelTransferResponse, FileExistenceResponse, InstallFilesResponse, UTInfosResponse, UploadFileResponse } from 'src/common/common-response';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { DownloadArtifact } from '@root/src/git_helper/git_artifact_downloader';
import { GitRepoInfo } from '@root/src/git_helper/git_helper';
import { environment } from '@environment/environment';

const gitRepoInfo: GitRepoInfo = new GitRepoInfo(environment.gitAccessKey, environment.swToolGitRepoId);
const app: express.Application = express();
const port: number = 3000;
interface CheckSumHashTable {
    [key: string]: boolean;
}

const cors = require('cors');
app.use(cors());
let cachedDirectUploadHashes: CheckSumHashTable = {};
let availableUts: Array<string> = ["192.168.100.64", "192.168.100.65", "172.16.20.97", "192.168.100.67", "192.168.100.1"];
let utInfosByIp: { [ip: string]: UTInfo } = {};
availableUts.forEach(ip => {
    utInfosByIp[ip] = { ip: ip, status: EUtStatus.Idle };
});
let installProcessesByUtIp: { [ip: string]: ChildProcessWithoutNullStreams } = {};
let fileInfos: Array<InstallFileInfo> = [];
let nextFileId = 0;

// Middleware
app.use(bodyParser.json()); //Allow handle json in body request

// Check if the  directories exists, and create it if it doesn’t
const serverDirs: Array<string> = Object.values(SERVER_CONFIG.storageDirs);
serverDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Read all files to init data (existing hashes, fileInfos) on startup
reloadUploadedFiles();

function reloadUploadedFiles(): void {
    const uploadDir = SERVER_CONFIG.storageDirs.uploadDir;
    fileInfos = [];
    //From direct upload
    fs.readdir(uploadDir, async (err, fileNames) => {
        if (err) {
            return console.error("Failed to list directory", err);
        }

        for (let fileName of fileNames) {
            checkCreateFileInfo(fileName, uploadDir);
        }
    });

    const repoDir: string = SERVER_CONFIG.storageDirs.uploadFromRepoDir;
    fs.readdir(repoDir, (err, directories) => {
        if (err) {
            console.error("Error reading the upload directory:", err);
            return;
        }

        //Assume everything is directory
        directories.forEach((folderName) => {
            const folderPath = path.join(repoDir, folderName);
            fs.readdir(folderPath, (err, fileNames) => {
                if (err) {
                    console.error("Error reading the directory:", err);
                    return;
                }

                fileNames.forEach(fileName => {
                    const jobId: string = folderName;
                    const fileInfo: InstallFileInfo | null = checkCreateFileInfo(fileName, folderPath, null, jobId);
                    if (fileInfo != null) {
                        console.log(`File name = ${fileInfo.fileName}, JobId = ${jobId}`);
                    }
                });
            });
        });
    });
}

// ====================== HANDLING REQUESTS ======================
// Check files exists request
app.post(CONFIG.apiPaths.checkFileExists, (req, res) => {
    const { hash } = req.body;

    //Sanity check
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
        // Usage:
        if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/i.test(hash)) {
            return sendErrRequestResponse(res, SERVER_CONFIG.statusCodes.badRequest, "Invalid hash format");
        }
    }

    const fileExists = cachedDirectUploadHashes[hash] === true;
    return res.json({ exists: fileExists } as FileExistenceResponse);
});

// Multer config for file upload
const diskStorage: multer.StorageEngine = multer.diskStorage({
    // A string or function that determines the destination path for uploaded files
    destination: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        cb(null, SERVER_CONFIG.storageDirs.uploadDir);
    },
    // A string or function that determines file name
    filename: function (req: express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        cb(null, file.originalname);  // Use original file name
    }
});
const upload: multer.Multer = multer({ storage: diskStorage });
// Upload files request
app.post(CONFIG.apiPaths.uploadFile, upload.single('file'), async (req, res) => {
    let fileInfo: InstallFileInfo | null = null;
    if (req.file) {
        const filePath: string = req.file.path; //Path upload to
        const dirPath: string = path.dirname(filePath);
        fileInfo = checkCreateFileInfo(req.file.filename, dirPath);

        //Cache direct uploaded hashes
        const fileHash: string = await calculateHash(filePath);
        cachedDirectUploadHashes[fileHash] = true;
    }

    res.json({ success: fileInfo != null, fileInfo: fileInfo } as UploadFileResponse);
});

function checkCreateFileInfo(fileName: string, folderPath: string, fileVersion: string | null = null, jobId: string | null = null): InstallFileInfo | null {
    if (!IsFileOkToInstall(fileName)) {
        return null;
    }

    fileVersion = fileVersion ?? GetFileVersion(fileName);
    const fileInfo: InstallFileInfo = {
        id: nextFileId,
        jobId: jobId,
        fileName: fileName,
        folderPath: folderPath,
        version: fileVersion,
        isLatestVersion: false
    };
    nextFileId += 1;
    fileInfos.push(fileInfo);
    fileInfos.sort((a, b) => CompareVersions(b.version, a.version));
    const latestVersionIndex = 0;  //Bigger version stand first
    fileInfos.forEach((fileInfo, index) => {
        fileInfo.isLatestVersion = (index === latestVersionIndex);
    });

    return fileInfo;
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

app.get(CONFIG.apiPaths.installDirectUploadedFile, (req, res) => {
    try {
        const utIp: string = req.query[CONFIG.requestObjectKeys.utIpAddress] as string;
        const fileId: number = parseInt(req.query[CONFIG.requestObjectKeys.installFileId] as string);
        const fileInfo = fileInfos.find(file => file.id === fileId);
        if (!fileInfo) {
            sendErrRequestResponse(res, SERVER_CONFIG.statusCodes.internalServerError, "Invalid file ID");
            return;
        }
        installSw(utIp, fileInfo, res);
    } catch (error) {
        console.log(`Caught unexpected error ${error}`);
        sendErrRequestResponse(res, SERVER_CONFIG.statusCodes.internalServerError, "Invalid hash format");
    }
});

function installSw(utIp: string, fileInfo: InstallFileInfo, res: express.Response) {
    if (!IsFileOkToInstall(fileInfo.fileName)) {
        throw new Error("File is not ok to install");
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const startTime = new Date().getTime();
    const installProcess: ChildProcessWithoutNullStreams = spawn('./MyVenvFolder/bin/python3', ['server/installer/install_sw.py',
        '-path', path.join(SERVER_CONFIG.storageDirs.uploadDir, fileInfo.fileName), '-ip', utIp, '-version', fileInfo.version]);
    installProcessesByUtIp[utIp] = installProcess;
    let latestLog: string = "";

    installProcess.stdout.on('data', (data: Buffer) => handleData(data));
    installProcess.stderr.on('data', (data: Buffer) => handleData(data));

    const handleData = (data: Buffer) => {
        const fullMsg = data.toString();
        if (fullMsg.startsWith("[InstallSw.py] Connecting")) {
            onStatusChange(utIp, EUtStatus.Connecting);
        } else if (fullMsg.startsWith("[InstallSw.py] Transferring")) {
            onStatusChange(utIp, EUtStatus.Transferring);
        } else if (fullMsg.startsWith("[InstallSw.py] Installing")) {
            onStatusChange(utIp, EUtStatus.Installing);
        } else {
            latestLog = fullMsg;
            console.log(`Latest log = ${latestLog}`);
            sendEventResponse(res, latestLog);
        }
    }

    const onStatusChange = (utIp: string, status: EUtStatus) => {
        utInfosByIp[utIp].status = status;
        console.log(`Update ip ${utIp} to status ${status}`);
    }

    installProcess.on('close', (code: number) => {
        console.log(`Python script completed with code ${code}.`);
        delete installProcessesByUtIp[utIp];
        const totalTimeStr: string = getTotalTimeStr(startTime);
        const isInstallSuccess: boolean = (code == 0);
        utInfosByIp[utIp].status = isInstallSuccess ? EUtStatus.Idle : EUtStatus.Error;
        if (isInstallSuccess) {
            sendEventResponse(res, `Install Success!. ${totalTimeStr}`, CONFIG.serverMessageVars.completeEvent);
        } else {
            sendEventResponse(res, `Install Failed!. Latest log = ${latestLog}. ${totalTimeStr}`, CONFIG.serverMessageVars.completeEvent);
        }
    });
}

app.get(CONFIG.apiPaths.cancelTranfer, (req, res) => {
    const utIp = req.query[CONFIG.requestObjectKeys.utIpAddress] as string;
    const utInfo = utInfosByIp[utIp];
    if (utInfo) {
        const canCancle: boolean = utInfo.status === EUtStatus.Transferring || utInfo.status === EUtStatus.Connecting;
        if (canCancle) {
            const pythonProcess = installProcessesByUtIp[utIp];
            if (pythonProcess && pythonProcess.exitCode === null) {
                pythonProcess.kill();
                utInfosByIp[utIp].status = EUtStatus.Idle;
                res.json({ message: 'Cancel transfer success!' } as CancelTransferResponse);
                return;
            }
        }
    }

    sendErrRequestResponse(res, SERVER_CONFIG.statusCodes.internalServerError, "Cannot cancel transfer");
});

app.get(CONFIG.apiPaths.getUtsInfos, (req, res) => {
    res.json({ utInfosByIp: utInfosByIp } as UTInfosResponse);
});

app.get(CONFIG.apiPaths.uploadArtifactFromRepo, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const jobId = req.query[CONFIG.requestObjectKeys.jobId] as string;
        const startTime = new Date().getTime();
        const outputDir = `${SERVER_CONFIG.storageDirs.uploadFromRepoDir}`;
        DownloadArtifact(gitRepoInfo, jobId, outputDir,
            (progressPercent: string) => {
                const progressStr: string = `Download progress: ${progressPercent}%`;
                console.log(progressStr);
                sendEventResponse(res, progressStr, CONFIG.serverMessageVars.progressEvent);
            }, (isSuccess: boolean, message: string, outputPath: string) => {
                if (isSuccess) {
                    const fileNameWithExtension = path.basename(outputPath);
                    checkCreateFileInfo(fileNameWithExtension, outputDir, null, jobId);
                }
                const totalTimeStr = getTotalTimeStr(startTime);
                sendEventResponse(res, `Download Success = ${isSuccess}, Msg = ${message}!.${totalTimeStr}`, CONFIG.serverMessageVars.completeEvent);
                return;
            });
    } catch (error) {
        console.log(`Caught unexpected error ${error}`);
        sendErrRequestResponse(res, SERVER_CONFIG.statusCodes.internalServerError, "Invalid hash format");
    }
});

app.get('*', (req: express.Request, res: express.Response) => {
    res.sendFile(path.join(__dirname, 'src/index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
});

function getTotalTimeStr(startTime: number): string {
    const totalTime = new Date().getTime() - startTime;
    const hours = Math.floor(totalTime / 3600000);
    const minutes = Math.floor((totalTime % 3600000) / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    const totalTimeStr = `Total time elapsed: ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
    return totalTimeStr;
}

function sendEventResponse(res: express.Response, data: any, eventName: string | null = null) {
    // Warning: The format should be fixed, read SSE events for details
    if (eventName) {
        res.write(`event: ${eventName}\n`);
    }
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendErrRequestResponse(res: express.Response, errorCode: number, errorMessage: string): express.Response {
    return res.status(errorCode).json({ error: errorMessage });
}
