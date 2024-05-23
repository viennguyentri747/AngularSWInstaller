import { UTInfo, InstallFileInfo } from "./common-model";

export interface ServerStatusResponse {
    isOnline: boolean;
}
export interface FileExistenceResponse {
    isExists: boolean;
}

export interface UploadFileResponse {
    isSuccess: boolean;
    fileInfo: InstallFileInfo | null;
}

export interface InstallFilesResponse {
    fileInfos: Array<InstallFileInfo>;
}

export interface CancelTransferResponse {
    message: string;
}

export interface UTInfosResponse {
    utInfosByIp: { [ip: string]: UTInfo };
}
