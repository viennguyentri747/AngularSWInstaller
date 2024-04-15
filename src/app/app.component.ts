// client/src/app/app.component.ts
import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';  // Import CommonModule


@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, HttpClientModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
    title = 'ng_sw_installer';
    selectedFile: File | null = null;

    constructor(private http: HttpClient) { }

    onFileSelected(event: any): void {
        this.selectedFile = event.target.files[0];
    }

    uploadFile(): void {
        if (this.selectedFile) {
            const formData = new FormData();
            formData.append('file', this.selectedFile, this.selectedFile.name);
            
            console.log("Try uploading ...")
            this.http.post('/upload', formData, { responseType: 'text' })
                .subscribe({
                    next: (response) => console.log('Upload successful', response),
                    error: (error) => console.log('Error during upload', error),
                    complete: () => console.log('Upload complete')  // Optional: If you need to do something on completion
                });
        }
    }
}
