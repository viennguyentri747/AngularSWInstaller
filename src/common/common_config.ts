export const CONFIG = {
    apiPaths: {
        checkFileExists: "/check_file_exist",
        uploadFile: "/upload_file",
        getExistingFileNames: "/read_existing_files_names",
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
    }
};

