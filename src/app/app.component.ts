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
    uploadProgress: number = 0;  // This will store the progress percentage
    uploadComplete: boolean = false;  // This flag checks if the upload is complete
    // fileName: string = '';  // Store the filename after upload

    files: string[] = [];

    constructor(private dataService: DataService) {
        this.reloadFiles();
    }

    onFileSelected(event: any): void {
        this.uploadComplete = false;  // Reset the completion flag on new file selection
        this.selectedUploadFile = event.target.files[0]; //single file selection
        console.log(`Selected filename: ${this.selectedUploadFile?.name}`)
    }

    uploadFile(): void {
        if (this.selectedUploadFile) {
            this.dataService.uploadFile(this.selectedUploadFile)
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

    onFinishUploaded() {
        this.uploadComplete = true;
        this.selectedUploadFile = null;
        this.clearUploadInputView()
        this.reloadFiles();
    }

    clearUploadInputView() {
        this.fileUploadInputRef.nativeElement.value = "";
    }

    reloadFiles() {
        this.dataService.getFiles().subscribe({
            next: (data) => this.files = data,
            error: (err) => {
                console.error('Failed to get files', err);
                alert('Error loading file list from server.');
            }
        });
    }

    installFile() {
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
