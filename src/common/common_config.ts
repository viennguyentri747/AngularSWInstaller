export const CONFIG = {
    apiPaths: {
        checkFileExists: "/checkFileExist",
        uploadFile: "/uploadFile",
        getExistingFileInfos: "/getExistingFileInfos",
        installDirectUploadedFile: "/installDirectUploaded",
        getUploadedArtifactJobIds: "/getDownloadedJobIdFromRepo",
        uploadArtifactFromRepo: "/downloadArtifactFromRepo",
        getUtsInfos: "/getUtInfos",
        cancelTranfer: "/cancelTransfer"
    },
    requestObjectKeys: {
        utIpAddress: "utIp",
        installFileId: "installFileId",
        jobId: "jobId"
    },
    serverMessageVars: {
        errorEvent: "error",
        completeEvent: "complete",
        progressEvent: "progress"
    },

};

export const SERVER_CONFIG = {
    statusCodes: {
        success: 200,
        notFound: 404,
        internalServerError: 500,
        unauthorized: 401,
        badRequest: 400
    },
    storageDirs: {
        uploadDir: "server_storage/upload/",
        uploadFromRepoDir: "server_storage/uploadFromRepo/",
        gitArtifactDir: "server_storage/gitArtifact/",
    }
};

export const CLIENT_CONFIG = {
    duration: {
        requestTimeoutMs: 2000,
        utInfoFetchMs: 1000,
    }
};

