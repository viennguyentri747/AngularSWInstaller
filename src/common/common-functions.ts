export async function CalculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function IsFileOkToUpload(file: File): boolean {
    // TODO: Check format (Ex: .iesa with version ...)
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


export function EscapePythonRepr(input: string): string {
    // This function assumes that the input string is surrounded by single quotes if it was repr-ed by Python
    // Strip the surrounding quotes if present
    if (input.startsWith("'") && input.endsWith("'")) {
        input = input.substring(1, input.length - 1);
    }

    return input
        // Replace escaped single quote
        .replace(/\\'/g, "'")
        // Replace escaped backslash
        .replace(/\\\\/g, '\\')
        // Replace other common escaped characters
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        // Add other escapes as necessary
        ;
}