// src/app/data.service.ts
import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CONFIG } from '@common/common_config';
import { FileExistenceResponse } from '@common/common-model';
import { Observable, lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpEvent } from '@angular/common/http';
import { UTInfo } from '@common/common-model';


@Injectable({
    providedIn: 'root'
})
export class DataService {
    constructor(private _zone: NgZone, private http: HttpClient) { }

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

    // public installFile(fileName: string, utIpAddress: string): Observable<string> {
    //     return this.http.post(CONFIG.apiPaths.installFile, { [CONFIG.requestObjectKeys.installFileName]: fileName, [CONFIG.requestObjectKeys.utIpAddress]: utIpAddress }, { responseType: 'text' });
    // }

    public installFile(fileName: string, utIp: string): Observable<any> {
        console.log(`Installing file ${fileName} on ${utIp}`);
        return new Observable(observer => {
            const url = new URL(CONFIG.apiPaths.installFile, window.location.origin);
            url.searchParams.append(CONFIG.requestObjectKeys.utIpAddress, utIp);
            url.searchParams.append(CONFIG.requestObjectKeys.installFileName, fileName);
            const eventSource = new EventSource(url);
            eventSource.onmessage = event => {
                this._zone.run(() => {
                    observer.next(event.data);
                });
            };

            eventSource.addEventListener(CONFIG.serverMessageVars.completeEvent, (event) => {
                this._zone.run(() => {
                    observer.next(event.data);
                    observer.complete()
                    eventSource.close();
                });
            });

            eventSource.addEventListener(CONFIG.serverMessageVars.errorEvent, (event) => {
                this._zone.run(() => {
                    observer.error(event.data);
                    eventSource.close();
                });
            })

            eventSource.onerror = error => {
                this._zone.run(() => {
                    observer.error(error);
                    eventSource.close();
                });
            };

            return () => eventSource.close();
        });
    }

    public getUtInfos(): Promise<{ [ip: string]: UTInfo }> {
        return lastValueFrom(this.http.get<{ [ip: string]: UTInfo }>(CONFIG.apiPaths.getUtsInfos))
    }
}
