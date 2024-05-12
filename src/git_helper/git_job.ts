// Job.ts
export class GitJob {
    id: number;
    status: string;
    stage: string;
    name: string;
    ref: string;
    tag: boolean;
    coverage: any;
    allow_failure: boolean;
    created_at: Date;
    started_at: Date;
    finished_at: Date;
    erased_at: Date | null;
    duration: number;
    queued_duration: number;
    user: any;  // Consider defining a more specific type
    commit: any;  // Consider defining a more specific type
    pipeline: any;  // Consider defining a more specific type
    web_url: string;
    project: any;  // Consider defining a more specific type
    artifacts: any[];  // Consider defining a more specific type
    runner: any;  // Consider defining a more specific type
    artifacts_expire_at: Date | null;
    archived: boolean;
    tag_list: string[];

    constructor(data: any) {
        this.id = data.id;
        this.status = data.status;
        this.stage = data.stage;
        this.name = data.name;
        this.ref = data.ref;
        this.tag = data.tag;
        this.coverage = data.coverage;
        this.allow_failure = data.allow_failure;
        this.created_at = new Date(data.created_at);
        this.started_at = new Date(data.started_at);
        this.finished_at = new Date(data.finished_at);
        this.erased_at = data.erased_at ? new Date(data.erased_at) : null;
        this.duration = data.duration;
        this.queued_duration = data.queued_duration;
        this.user = data.user;
        this.commit = data.commit;
        this.pipeline = data.pipeline;
        this.web_url = data.web_url;
        this.project = data.project;
        this.artifacts = data.artifacts;
        this.runner = data.runner;
        this.artifacts_expire_at = data.artifacts_expire_at ? new Date(data.artifacts_expire_at) : null;
        this.archived = data.archived;
        this.tag_list = data.tag_list;
    }
}
