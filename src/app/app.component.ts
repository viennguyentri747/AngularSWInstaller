import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpClientModule, HttpResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';  // Import FormsModule here
import { DataService } from './data.service';
import { FileSizePipe } from './file-size.pipe';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-root',
    standalone: true,
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    imports: [RouterOutlet, CommonModule, HttpClientModule, FormsModule, FileSizePipe], providers: [DataService]
})
export class AppComponent {
    @ViewChild('fileUploadInput') fileUploadInputRef!: ElementRef; //'!' to inform type script that variable will be initialized
    existingFileNames: string[] = [];
    title = 'ng_sw_installer';
    selectedInstallFile: string | null = null;  // Changed to string to hold the file name
    availableUtIps: string[] = [];
    selectedUtIp: string | null = null
    selectedUploadFile: File | null = null;
    isUploading: boolean = false;
    uploadProgress: number = 0;
    currentTab: string = 'existing';


    constructor(private dataService: DataService) {
        this.fetchAvailableFiles();
    }

    public onSelectInstallSourceTab(tabId: string): void {
        this.currentTab = tabId;
        this.clearOnNewTab();
    }

    private clearOnNewTab(): void {
        this.selectedInstallFile = null;
        this.selectedUtIp = null;
        this.selectedUploadFile = null;
        this.uploadProgress = 0;
        this.clearUploadInputView();
    }

    public onSelectFileForUpload(event: Event): void {
        const inputElement = event.target as HTMLInputElement;
        if (!inputElement.files?.length) {
            return
        }

        const file = inputElement.files[0];
        this.calculateChecksum(file).then(hash => {
            this.dataService.checkFileExists(hash).subscribe(exists => {
                if (!exists) {
                    this.selectedUploadFile = file;
                } else {
                    alert('File already exists.');
                    this.clearUploadInputView();
                }
            });
        });
    }


    public uploadSelectedFile(): void {
        this.isUploading = true;
        if (this.selectedUploadFile) {
            this.dataService.uploadFile(this.selectedUploadFile)
                .subscribe({
                    next: (event) => {
                        if (event.type === HttpEventType.UploadProgress) {
                            if (event.total) {
                                this.uploadProgress = Math.round(100 * event.loaded / event.total);
                            }
                        } else if (event instanceof HttpResponse) {
                            this.onFinishUploaded(true)
                        }
                    },
                    error: (error) => {
                        console.error('Upload failed:', error);
                        this.onFinishUploaded(false)
                    }
                }

                );
        }
    }

    private onFinishUploaded(is_success: boolean): void {
        this.isUploading = false;

        if (is_success) {
            this.onSelectFileForInstall(this.selectedUploadFile?.name ?? null); // Automatically select the uploaded file
            this.uploadProgress = 100;
        } else {
            this.uploadProgress = 0;
        }

        this.selectedUploadFile = null;
        this.clearUploadInputView();
        this.fetchAvailableFiles();
    }

    private clearUploadInputView(): void {
        this.fileUploadInputRef.nativeElement.value = "";
    }

    private fetchAvailableFiles(): void {
        this.dataService.getExistingFileNames().subscribe({
            next: (resp) => this.existingFileNames = resp,
            error: (err) => console.error('Failed to get files', err)
        });
    }

    public onSelectFileForInstall(installFileName: string | null): void {
        console.log(`File for install seleted: ${installFileName}`);
        this.selectedInstallFile = installFileName
        this.fetchAvailableUts();
    }

    private fetchAvailableUts(): void {
        this.dataService.getAvailableUts().subscribe({
            next: (resp) => this.availableUtIps = resp,
            error: (err) => console.error('Failed to get files', err)
        });
    }

    public installFile(): void {
        if (!this.selectedInstallFile) {
            alert('No file selected!');
            return;
        }
        this.dataService.installFile(this.selectedInstallFile).subscribe({
            next: (resp) => alert('Installation successful!'),
            error: (err) => {
                console.error('Installation failed', err);
                alert('Installation failed! Please try again.');
            }
        });
    }

    public onSelectUt(utIp: string | null): void {
        console.log(`Ut seleted: ${utIp}`);
        this.selectedUtIp = utIp;
    }

    private async calculateChecksum(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
