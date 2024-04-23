export class InstallerHelper {
    public static async CalculateChecksum(file: File): Promise < string > {
        const buffer = await file.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public static IsFileOkToUpload(file:File): boolean{
        // TODO: Check format (Ex: .iesa with version ...)

        return true
    }

}