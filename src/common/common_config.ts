export const CONFIG = {
    apiPaths: {
        checkFileExists: "/check_file_exist",
        uploadFile: "/upload_file",
        getExistingFileInfos: "/get_existing_file_infos",
        installFile: "/install",
        getUtsInfos: "/get_ut_infos"
    },
    requestObjectKeys:{
        utIpAddress: "utIp",
        installFileName: "installFileName"
    },
    serverMessageVars: {
        errorEvent: "error",
        completeEvent: "complete",
        progressEvent: "progress"
    },
    storagePaths:{
        upload: "storage/upload",
        download: "storage/download"
    },
    installerVersion:{
        latest: "0.9.8.4"
    }
};

