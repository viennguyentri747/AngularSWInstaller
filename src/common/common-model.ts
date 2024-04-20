export interface FileExistenceResponse {
    exists: boolean;
}

export interface UTInfo {
    ip: string;
    status: EUtStatus;
}

export enum EUtStatus {
    Idle = 'Idle',
    Installing = 'Installing',
    Error = 'Error'
}
