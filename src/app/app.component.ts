// src/app/app.component.ts
import { Component, EventEmitter, ElementRef, ViewChild } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpClientModule, HttpResponse } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DataService } from './data.service';
import { FormsModule } from '@angular/forms'; //for working with 2-way data binding ...
@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, HttpClientModule, FormsModule],
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
    providers: [DataService]  // Providing the DataService here
})
export class AppComponent {
    @ViewChild('fileUploadInput') fileUploadInputRef!: ElementRef; //'!' to inform type script that variable will be initialized
    title = 'ng_sw_installer';
    selectedInstallFile: File | null = null;
    selectedUploadFile: File | null = null;
    is_uploading: boolean = false;
    uploadProgress: number = 0;  // This will store the progress percentage
    // fileName: string = '';  // Store the filename after upload

    files: string[] = [];

    constructor(private dataService: DataService) {
        this.reloadFiles();
    }

    onFileSelected(event: Event): void {
        const inputElement = (event.target as HTMLInputElement)
        if (inputElement && inputElement.files) {
            const file = inputElement.files[0];
            if (file) {
                this.calculateChecksum(file).then(hash => {
                    console.log('File hash:', hash);
                    this.dataService.checkFileExists(hash).subscribe(isExists => {
                        if (!isExists) {
                            this.selectedUploadFile = file;
                        } else {
                            alert('File already exists.');
                        }
                    });
                });
            }
        }
    }

    private async calculateChecksum(file: File): Promise<string> {
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public uploadSelectedFile(): void {
        // TODO HANDLE INTERRUPT
        this.is_uploading = true;
        const file: File | null = this.selectedUploadFile;
        if (file) {
            this.dataService.uploadFile(file)
                .subscribe(event => {
                    if (event.type === HttpEventType.UploadProgress) {
                        if (event.total) {
                            this.uploadProgress = Math.round(100 * event.loaded / (event.total || 1));
                        }
                    } else if (event instanceof HttpResponse) {
                        console.log('Upload complete');
                        this.onFinishUploaded()
                    }
                });
        }
    }

    private onFinishUploaded(): void {
        this.is_uploading = false;
        this.selectedUploadFile = null;
        this.clearUploadInputView()
        this.reloadFiles();

    }

    private clearUploadInputView(): void {
        this.fileUploadInputRef.nativeElement.value = "";
    }

    private reloadFiles(): void {
        this.dataService.getFiles().subscribe({
            next: (data) => this.files = data,
            error: (err) => {
                console.error('Failed to get files', err);
                alert('Error loading file list from server.');
            }
        });
    }

    public installFile(): void {
        if (!this.selectedInstallFile) {
            alert('No file selected!');
            return;
        }
        this.dataService.installFile(this.selectedInstallFile.name).subscribe({
            next: (resp) => alert('Installation successful!'),
            error: (err) => {
                console.error('Installation failed', err);
                alert('Installation failed! Please try again.');
            }
        });
    }
}
