import { UTInfo, InstallFileInfo } from "./common-model";

export interface FileExistenceResponse {
    exists: boolean;
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
