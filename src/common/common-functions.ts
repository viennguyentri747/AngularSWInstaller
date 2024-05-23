export async function CalculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function IsFileOkToInstall(fileName: string): boolean {
    // TODO: Check format (Ex: .iesa with version ...)
    const extensionList = ['.iesa']; // Add your desired extensions here
    const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
    if (!extensionList.includes(fileExtension)) {
        return false;
    }

    return true;
}

export function GetFileVersion(filename: string): string {
    // FULL_TAR_NAME=ow_core_apps-$CI_COMMIT_REF_SLUG-$VERSION.iesa. Ex: ow_core_apps-release-master-0.9.8.4.iesa
    const versionRegex = /-(\d+\.\d+\.\d+\.\d+)\.iesa$/; //Get 4 number after - and before .iesa
    const match = filename.match(versionRegex);
    if (match && match[1]) {
        return match[1];
    }

    return "Unknown Version";
}

export function CompareVersions(versionA: string, versionB: string): number {
    const partsA = versionA.split('.').map(Number); //numbers in version. Ex: 0.9.5 -> [0,9,5]
    const partsB = versionB.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] || 0; //0 is default value if cannot detect
        const partB = partsB[i] || 0;

        if (partA < partB) {
            return -1;
        } else if (partA > partB) {
            return 1;
        }
    }

    return 0;
}
