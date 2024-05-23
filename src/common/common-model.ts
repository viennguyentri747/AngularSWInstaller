export interface UTInfo {
    ip: string;
    status: EUtStatus;
}

export enum EUtStatus {
    Idle = 'Idle',
    Connecting = 'Connecting',
    Transferring = 'Transferring',
    Installing = 'Installing',
    Error = 'Error'
}

export interface InstallFileInfo {
    id: number;
    jobId: string | null;
    fileName: string;
    folderPath: string;
    version: string;
    isLatestVersion: boolean;
}

