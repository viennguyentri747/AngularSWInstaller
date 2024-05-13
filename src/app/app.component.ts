import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpClientModule, HttpResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';  // Import FormsModule here
import { DataService } from './data.service';
import { FileSizePipe } from './file-size.pipe';
import { CommonModule } from '@angular/common';
import { EUtStatus, UTInfo, InstallFileInfo } from '@common/common-model'
import { IsFileOkToInstall, CalculateChecksum } from 'src/common/common-functions';
import { GitJob } from 'src/git_helper/git_job';
import { GetGitJobsUntilCutoff } from 'src/git_helper/git_job_fetcher';
import { environment } from './../environments/environment';

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
    totalExtraMonthGetJobs: number = 1 //0 = get current month only
    releaseJobs: Array<GitJob> = []
    title = 'ng_sw_installer';
    selectedInstallFile: string | null = null;  // Changed to string to hold the file name
    selectedUploadFile: File | null = null;
    isUploading: boolean = false;
    uploadProgress: number = 0;
    currentTab: string = 'existing';
    isReadyToInstall: boolean = false;

    constructor(private dataService: DataService) {
        this.fetchAllData();

        setInterval(() => {
            this.fetchAllData();
        }, 1000);
    }

    private fetchAllData(): void {
        this.fetchAvailableFiles();
        this.fetchUtInfos();
        this.fetchGitBuildReleaseJobs();
    }

    public hasUtInfos(): boolean {
        return Object.values(this.utInfosByIp).length > 0;
    }

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
                if (!exists) {
                    this.selectedUploadFile = file;
                } else {
                    alert('File already exists.');
                    this.clearUpload();
                }
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
                        alert(`Finish upload file ${fileToUpload?.name}!`);
                        this.onFinishUploaded(true)
                    }
                },
                error: (error) => {
                    this.onRequestError('Upload files.', error);
                    this.onFinishUploaded(false)
                }
            });
    }

    private onFinishUploaded(is_success: boolean): void {
        if (is_success) {
            this.onSelectFileForInstall(this.selectedUploadFile?.name ?? null); // Automatically select the uploaded file
        }

        this.clearUpload();
        this.fetchAvailableFiles();
    }

    private clearUpload(): void {
        this.isUploading = false;
        this.selectedUploadFile = null;
        this.uploadProgress = 0;
        this.fileUploadInputRef.nativeElement.value = "";
    }

    private async fetchGitBuildReleaseJobs(): Promise<void> {
        this.releaseJobs = [];
        let retryCount = 3;
        while (retryCount > 0) {
            try {
                const jobs: Array<GitJob> = await GetGitJobsUntilCutoff(environment.gitAccessKey, this.totalExtraMonthGetJobs);
                this.releaseJobs = jobs.filter(job => {
                    if (job.name !== 'package_oneweb_core_apps_release') {
                        return false;
                    }
                    if (job.ref !== 'master') {
                        return false;
                    }
                    return true;
                });
                break; // Exit the loop if successful
            } catch (error) {
                console.error('Error fetching Git build release jobs:', error);
                retryCount--;
                if (retryCount > 0) {
                    console.log('Retrying now ...')
                }
            }
        }
    }

    private fetchAvailableFiles(): void {
        this.dataService.getUploadedFileInfos().subscribe({
            next: (resp) => this.uploadedFileInfos = resp,
            error: (err) => {
                this.onRequestError('Get files', err);
            }
        });
    }

    public onSelectFileForInstall(installFileName: string | null): void {
        console.log(`File for install seleted: ${installFileName}`);
        this.selectedInstallFile = installFileName
        this.fetchUtInfos();
    }

    public installFile(fileName: string, utIp: string): void {
        this.dataService.installFile(fileName, utIp).subscribe(
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
                    console.log(`Complete installing file ${fileName}`);
                    this.fetchUtInfos();
                },
            }
        )
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

    private async fetchUtInfos(): Promise<void> {
        this.dataService.getUtInfos().subscribe({
            next: (resp) => this.utInfosByIp = resp,
            error: (err) => {
                this.onRequestError('Get UT Infos', err);
                this.utInstallLogsByIp = {}
            }
        });
    }

    private onRequestError(requestAction: string, error: any): void {
        console.error(`${requestAction} failed!. Error: `, error);
    }


}
