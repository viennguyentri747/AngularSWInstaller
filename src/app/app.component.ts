import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpEventType, HttpClientModule, HttpResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';  // Import FormsModule here
import { DataService } from './data.service';
import { FileSizePipe } from './file-size.pipe';
import { CommonModule } from '@angular/common';
import { EUtStatus, UTInfo, InstallFileInfo } from '@common/common-model'
import { IsFileOkToInstall, CalculateChecksum } from 'src/common/common-functions';
import { GitJob } from 'src/git_helper/git_job';
import { GetGitJobsUntilCutoff } from 'src/git_helper/git_job_fetcher';
import { environment } from '@environment/environment';
import { GitRepoInfo } from '@src/git_helper/git_helper';
import { lastValueFrom } from 'rxjs';
import { UploadFileResponse } from '@common/common-response';


@Component({
    selector: 'app-root',
    standalone: true,
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [RouterOutlet, CommonModule, HttpClientModule, FormsModule, FileSizePipe], providers: [DataService]
})
export class AppComponent {
    @ViewChild('fileUploadInput') fileUploadInputRef!: ElementRef; //'!' to inform type script that variable will be initialized
    utInfosByIp: { [ip: string]: UTInfo } = {}; // Key: ut_ip
    utInstallLogsByIp: { [ip: string]: string } = {}; // Key: ut_ip
    uploadedFileInfos: Array<InstallFileInfo> = []
    gitRepoInfo: GitRepoInfo = new GitRepoInfo(environment.gitAccessKey, environment.swToolGitRepoId);
    uploadingJobIds: Array<string> = [];
    uploadedJobIds: Array<string> = [];
    uploadedJobLogByJobId: { [id: string]: string } = {};
    totalExtraMonthGetJobs: number = 1 //0 = get current month only
    releaseJobs: Array<GitJob> = []
    title = 'ng_sw_installer';
    selectedInstallFile: InstallFileInfo | null = null;  // Changed to string to hold the file name
    selectedUploadFile: File | null = null;
    isUploading: boolean = false;
    uploadProgress: number = 0;
    currentTab: string = 'existing';
    isReadyToInstall: boolean = false;
    isServerOnline: boolean = false;

    constructor(private dataService: DataService) {
        console.log("Constructor Called");
        this.scheduleAction(this.fetchServerOnlineStatus.bind(this), 1500, 1000);
        this.scheduleAction(this.fetchCommonDatas.bind(this), 1500, 1000);
        this.scheduleAction(this.fetchGitBuildReleaseJobs.bind(this), 3000, 1000);
    }

    /**
     * Schedules an asynchronous function call to be executed repeatedly at specified intervals.
     * @param asyncFunctionCall - The async function to fetch some kind of data, it return boolean if fetch from server success (false if there is an error).
     */
    private async scheduleAction(asyncFunctionCall: () => Promise<boolean>, intervalMsOnSuccess: number, intervalMsOnFail: number = intervalMsOnSuccess): Promise<void> {
        console.log(`Start fetching ${asyncFunctionCall.name}`);
        const isSuccess: boolean = await asyncFunctionCall();
        console.log(`Complete fetching ${asyncFunctionCall.name}, success = ${isSuccess}`);
        const repeatIntervalMs = isSuccess ? intervalMsOnSuccess : intervalMsOnFail;
        setTimeout(() => this.scheduleAction(asyncFunctionCall, intervalMsOnSuccess, intervalMsOnFail), repeatIntervalMs);
    }

    private async fetchServerOnlineStatus(): Promise<boolean> {
        try {
            this.isServerOnline = await lastValueFrom(this.dataService.checkServerOnline());
            return true;
        }
        catch (err) {
            this.isServerOnline = false;
            return false;
        } finally {
            console.log(`Server is online = ${this.isServerOnline}`)
        }
    }

    private async fetchCommonDatas(): Promise<boolean> {
        if (!this.isServerOnline) {
            return false;
        }

        await Promise.all([
            this.fetchAvailableFiles(),
            this.fetchUtInfos()
        ]);

        return true;
    }

    private async fetchAvailableFiles(): Promise<void> {
        try {
            const resp: InstallFileInfo[] = await lastValueFrom(this.dataService.getUploadedFileInfos());
            this.uploadedFileInfos = resp;
        } catch (err) {
            this.onRequestError('Get files', err);
        }
    }

    public onSelectFileForInstall(installFileInfo: InstallFileInfo | null): void {
        if (installFileInfo != null) {
            console.log(`File for install seleted: ${installFileInfo.fileName}`);
            this.selectedInstallFile = installFileInfo
            this.fetchUtInfos();
        }
    }

    public canInstall(utInfo: UTInfo) {
        return this.selectedInstallFile && (utInfo.status === EUtStatus.Idle || utInfo.status == EUtStatus.Error);
    }

    public installFile(fileInfo: InstallFileInfo, utIp: string): void {
        this.dataService.installFile(fileInfo, utIp).subscribe(
            {
                next: (resp) => {
                    if (resp) {
                        const installLog = JSON.parse(resp);
                        this.utInstallLogsByIp[utIp] = installLog;
                    }
                },
                error: (err) => {
                    this.onRequestError('Install files', err);
                },
                complete: () => {
                    console.log(`Complete installing file ${fileInfo.fileName}`);
                    this.fetchUtInfos();
                },
            }
        );
    }

    private async fetchUtInfos(): Promise<void> {
        try {
            const resp = await lastValueFrom(this.dataService.getUtInfos());
            this.utInfosByIp = resp;
        } catch (err) {
            this.onRequestError('Get UT Infos', err);
            this.utInstallLogsByIp = {};
        }
    }

    public canCancelTransfer(utInfo: UTInfo) {
        return (utInfo.status === EUtStatus.Connecting || utInfo.status === EUtStatus.Transferring);
    }

    public cancelTransfer(utIp: string): void {
        this.dataService.cancelTransfer(utIp).subscribe(
            {
                error: (err) => {
                    this.onRequestError('Cancel transfer', err);
                }
            }
        )
    }

    private async fetchGitBuildReleaseJobs(): Promise<boolean> {
        let retryCount = 3;
        while (this.isServerOnline && retryCount > 0) {
            try {
                const isFetchNew: boolean = this.releaseJobs.length == 0;
                const tempReleaseJobs: Array<GitJob> = [];
                const allJobs: Array<GitJob> = [];
                for await (const job of GetGitJobsUntilCutoff(this.gitRepoInfo, this.totalExtraMonthGetJobs, 5, 10)) {
                    allJobs.push(job);
                    if (job.name === 'package_oneweb_core_apps_release' && job.ref === 'master') {
                        tempReleaseJobs.push(job);
                        if (isFetchNew) {
                            // Copy immediately
                            this.releaseJobs = tempReleaseJobs;
                        }
                    }
                }

                this.releaseJobs = tempReleaseJobs;
                return true
            } catch (error) {
                console.error('Error fetching Git build release jobs:', error);
                retryCount--;
                if (retryCount > 0) {
                    console.log('Retrying fetch git jobs now ...')
                }
            }
        }

        return false;
    }

    private onRequestError(requestAction: string, error: any): void {
        console.error(`${requestAction} failed!. Error: `, error);
    }

    // ====================== PUBLIC FUNCTIONS FOR HTML ======================
    public onSelectInstallSourceTab(tabId: string): void {
        this.currentTab = tabId;
        this.unSetSelected();
    }

    private unSetSelected(): void {
        this.selectedInstallFile = null;
        this.clearUpload();
    }

    public onSelectFileForUpload(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        if (!inputElement.files?.length) {
            this.clearUpload();
            return;
        }

        const file = inputElement.files[0];
        if (!IsFileOkToInstall(file.name)) {
            return;
        }

        CalculateChecksum(file).then(hash => {
            this.dataService.checkFileExists(hash).subscribe(exists => {
                if (exists) {
                    alert('File already exists.');
                }

                this.selectedUploadFile = file;
            });
        });
    }

    public uploadFile(fileToUpload: File): void {
        this.isUploading = true;
        this.dataService.uploadFile(fileToUpload)
            .subscribe({
                next: (event) => {
                    if (event.type === HttpEventType.UploadProgress) {
                        if (!event.total) {
                            return;
                        }
                        this.uploadProgress = Math.round(100 * event.loaded / event.total);
                    } else if (event instanceof HttpResponse) {
                        const uploadResponse: UploadFileResponse = event.body;
                        const isSuccess = uploadResponse.isSuccess;
                        alert(`Finish upload, success = ${isSuccess}`);
                        this.onFinishUploaded(isSuccess, uploadResponse.fileInfo);
                    }
                },
                error: (error) => {
                    this.onRequestError('Upload files.', error);
                    this.onFinishUploaded(false, null);
                }
            });
    }

    private onFinishUploaded(isSuccess: boolean, fileInfo: InstallFileInfo | null): void {
        if (isSuccess && fileInfo != null) {
            this.onSelectFileForInstall(fileInfo); // Automatically select the uploaded file
            this.fetchAvailableFiles();
        }

        this.clearUpload();
    }

    private clearUpload(): void {
        this.isUploading = false;
        this.selectedUploadFile = null;
        this.uploadProgress = 0;
        this.fileUploadInputRef.nativeElement.value = "";
    }

    public isShowDownloadGitArtifactBtn(jobId: string): boolean {
        return this.isServerOnline && !this.isGitArtifactDownloaded(jobId) && !this.isUploadingJobArtifact(jobId) && !(this.uploadedJobIds.hasOwnProperty(jobId));
    }

    public isShowSelectDownloadedJobBtn(jobId: string): boolean {
        return !this.isGitJobSelected(jobId) && this.isGitArtifactDownloaded(jobId);
    }

    public isGitJobSelected(jobId: string): boolean {
        return this.selectedInstallFile != null && this.selectedInstallFile.jobId === jobId;
    }

    public isUploadingJobArtifact(jobId: string): boolean {
        return this.uploadingJobIds.includes(jobId)
    }

    private isGitArtifactDownloaded(jobId: string): boolean {
        const fileInfo: InstallFileInfo | null = this.getUploadedFileInfo(jobId);
        return fileInfo != null;
    }

    public uploadGitJobArtifact(jobId: string) {
        this.uploadingJobIds.push(jobId);
        this.dataService.uploadGitJobArtifact(jobId).subscribe(
            {
                next: (resp) => {
                    if (resp) {
                        const uploadLog = JSON.parse(resp);
                        this.uploadedJobLogByJobId[jobId] = uploadLog;
                    }
                },
                error: (err) => {
                    this.uploadedJobLogByJobId[jobId] = `Error: ${err}`;
                    this.uploadingJobIds = this.uploadingJobIds.filter(id => id != jobId);
                    this.onRequestError('Upload artifact', err);
                },
                complete: () => {
                    const completeLog = `Upload artifact of job with JobId = ${jobId} Complete!`;
                    this.uploadedJobLogByJobId[jobId] = completeLog;
                    this.uploadedJobIds.push(jobId);
                    this.uploadingJobIds = this.uploadingJobIds.filter(id => id != jobId);
                },
            }
        );
    }

    public selectGitArtifactForInstall(jobId: string): void {
        const fileInfo: InstallFileInfo | null = this.getUploadedFileInfo(jobId);
        if (fileInfo) {
            this.onSelectFileForInstall(fileInfo);
        }
    }

    private getUploadedFileInfo(jobId: string): InstallFileInfo | null {
        return this.uploadedFileInfos.find(file => file.jobId === jobId) || null;
    }

    public hasUtInfos(): boolean {
        return Object.values(this.utInfosByIp).length > 0;
    }
}
