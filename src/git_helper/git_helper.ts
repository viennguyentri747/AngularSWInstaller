import { GitJob } from './git_job';

export class GitRepoInfo {
    private _accessToken: string;

    get accessToken(): string {
        return this._accessToken;
    }

    private _projectId: string;
    get projectId(): string {
        return this._projectId;
    }

    constructor(accessToken: string, projectId: string) {
        this._accessToken = accessToken;
        this._projectId = projectId;
    }
}
