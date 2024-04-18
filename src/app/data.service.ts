// src/app/data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from '@config/common_config';
import { FileExistenceResponse } from 'src/common/common-model';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpEvent } from '@angular/common/http';


@Injectable({
    providedIn: 'root'
})
export class DataService {
    constructor(private http: HttpClient) { }

    public getExistingFileNames(): Observable<string[]> {
        return this.http.get<string[]>(CONFIG.apiPaths.getExistingFileNames);
    }

    public checkFileExists(hash: String): Observable<boolean> {
        return this.http.post<FileExistenceResponse>(CONFIG.apiPaths.checkFileExists, { hash }).pipe(
            map((response: FileExistenceResponse) => {
                console.log(response);
                return response.exists;
            })
        );
    }

    public uploadFile(file: File): Observable<HttpEvent<any>> {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post(CONFIG.apiPaths.uploadFile, formData, {
            reportProgress: true,
            observe: 'events'
        });
    }

    public installFile(filename: string): Observable<string> {
        return this.http.post(CONFIG.apiPaths.installFile, { filename }, { responseType: 'text' });
    }

    public getAvailableUts(): Observable<string[]> {
        return this.http.get<string[]>(CONFIG.apiPaths.getAvailableUts);
    }
}
