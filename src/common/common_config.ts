export const CONFIG = {
    apiPaths: {
        checkFileExists: "/check_file_exist",
        uploadFile: "/upload_file",
        getExistingFileInfos: "/get_existing_file_infos",
        installFile: "/install",
        getUtsInfos: "/get_ut_infos"
    },
    requestObjectKeys: {
        utIpAddress: "utIp",
        installFileName: "installFileName"
    },
    serverMessageVars: {
        errorEvent: "error",
        completeEvent: "complete",
        progressEvent: "progress"
    },
    storagePaths: {
        upload: "storage/upload",
        download: "storage/download"
    }
};

export const SERVER_CONFIG = {
    status_code: {
        success: 200,
        notFound: 404,
        internalServerError: 500,
        unauthorized: 401,
        badRequest: 400
    }
};

export const CLIENT_CONFIG = {
    duration: {
        requestTimeoutMs: 2000,
        utInfoFetchMs: 1000,
    }
};

