// src/app/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from '@config/common_config';


@Injectable({
    providedIn: 'root'
})
export class DataService {

    constructor(private http: HttpClient) { }

    getFiles() {
        return this.http.get<string[]>(CONFIG.apiPaths.readFilesUrl);
    }

    uploadFile(file: File) {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post(CONFIG.apiPaths.uploadFileUrl, formData, {
            reportProgress: true,
            observe: 'events'
        })
    }

    installFile(filename: string) {
        return this.http.post(CONFIG.apiPaths.installFileUrl, { filename }, { responseType: 'text' });
    }
}
