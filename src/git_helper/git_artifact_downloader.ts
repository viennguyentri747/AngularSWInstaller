import { GitRepoInfo } from '@src/git_helper/git_helper';
import * as fs from 'fs';
import * as path from 'path';
import { Buffer } from 'buffer'; // Import Buffer from buffer module
import axios from 'axios';
import * as unzipper from 'unzipper';
import { SERVER_CONFIG } from '../common/common_config';

const GITLAB_URL = 'https://gitlab.com';

/**
 * Downloads an artifact from a Git repository and store it into local (server) folder.
 *
 * @param callBackProgressUpdate - callback with percent number str(max = "100" for 100%).
 * @param targetFolderLocation - The location where the artifact will be saved. Defaults to the jobId.
 */
export async function DownloadArtifact(
    gitInfo: GitRepoInfo,
    jobId: string,
    targetFolderLocation: string,
    callBackProgressUpdate: (progressPercent: string) => void,
    onFinish: (isSuccess: boolean, message: string, outputFolderPath: string) => void
) {
    const url = `${GITLAB_URL}/api/v4/projects/${gitInfo.projectId}/jobs/${jobId}/artifacts`;
    console.log(url)
    const headers = {
        'PRIVATE-TOKEN': gitInfo.accessToken
    };
    axios({
        method: 'get',
        url: url,
        responseType: 'stream',
        headers: headers
    }).then(response => {
        const totalSize: number = Number(response.headers['content-length']);
        let downloadedSize: number = 0;
        const fileName: string = `${jobId}`
        const zipFolderPath: string = path.join(SERVER_CONFIG.storageDirs.gitArtifactDir, `${fileName}_tmp.zip`);
        const fileStream: fs.WriteStream = fs.createWriteStream(zipFolderPath);

        response.data.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            const percent: string = ((downloadedSize / totalSize) * 100).toFixed(3);
            callBackProgressUpdate(percent);
            fileStream.write(chunk);
        });

        response.data.on('end', () => {
            fileStream.end();
            const destFolderPath: string = path.join(targetFolderLocation, `${fileName}`);
            unpackZipFile(zipFolderPath, destFolderPath).then(() => {
                console.log(`Removing ${zipFolderPath}`);
                //Remove zip file
                fs.unlink(zipFolderPath, (err) => {
                    if (err) console.error('Error removing zip file:', err);
                });
                console.log(`Artifact downloaded successfully. Unpack at ${destFolderPath}`);
                onFinish(true, "Ok.", destFolderPath);
            }).catch((err) => {
                console.error('Error unpacking zip file:', err);
                onFinish(false, `Error = ${err}.`, destFolderPath);
            });
        });

        response.data.on('error', (err: Error) => {
            fs.unlinkSync(zipFolderPath); //delete the temp file
            onFinish(false, `Download failed: ${err.message}`, "");
        });
    }).catch(err => {
        onFinish(false, `Download failed: ${err.message}`, "");
    });
}

async function unpackZipFile(zipFilePath: string, targetFolderLocation: string): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.createReadStream(zipFilePath)
            .pipe(unzipper.Extract({ path: targetFolderLocation }))
            .on('close', resolve)
            .on('error', reject);
    });
}

