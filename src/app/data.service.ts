// src/app/data.service.ts
import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from '@common/common_config';
import { InstallFileInfo } from '@common/common-model';
import { FileExistenceResponse, InstallFilesResponse, UTInfosResponse as UTInfosResponse } from '@common/common-response'
import { Observable, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpEvent } from '@angular/common/http';
import { UTInfo } from '@common/common-model';


@Injectable({
    providedIn: 'root'
})
export class DataService {
    constructor(private _zone: NgZone, private http: HttpClient) { }

    public getUploadedFileInfos(): Observable<InstallFileInfo[]> {
        return this.http.get<InstallFilesResponse>(CONFIG.apiPaths.getExistingFileInfos).pipe(map((response: InstallFilesResponse) => {
            console.log(response);
            return response.fileInfos;
        }));
    }

    public getUtInfos(): Observable<{ [ip: string]: UTInfo }> {
        return this.http.get<UTInfosResponse>(CONFIG.apiPaths.getUtsInfos).pipe(map((response: UTInfosResponse) => {
            console.log(response);
            return response.utInfosByIp;
        }));
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

    public installFile(fileName: string, utIp: string): Observable<any> {
        console.log(`Installing file ${fileName} on ${utIp}`);
        return new Observable(observer => {
            const url = new URL(CONFIG.apiPaths.installFile, window.location.origin);
            url.searchParams.append(CONFIG.requestObjectKeys.utIpAddress, utIp);
            url.searchParams.append(CONFIG.requestObjectKeys.installFileName, fileName);
            const eventSource = new EventSource(url);
            eventSource.onmessage = event => {
                this._zone.run(() => {
                    const message = event.data
                    observer.next(message);
                });
            };

            eventSource.addEventListener(CONFIG.serverMessageVars.completeEvent, (event) => {
                this._zone.run(() => {
                    const message = event.data
                    observer.next(message);
                    observer.complete()
                    eventSource.close();
                });
            });

            eventSource.onerror = error => {
                this._zone.run(() => {
                    observer.error(error);
                    eventSource.close();
                });
            };

            return () => eventSource.close();
        });
    }


}
