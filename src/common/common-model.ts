export interface UTInfo {
    ip: string;
    status: EUtStatus;
}

export enum EUtStatus {
    Idle = 'Idle',
    Transferring = 'Transferring',
    Installing = 'Installing',
    Error = 'Error'
}

export interface InstallFileInfo {
    fileName: string;
    version: string;
    isLatestVersion: boolean;
}

