import 'dotenv/config';
import envCfg from '@root/src/global/env_cfg';
import { GitJob } from '@src/git_helper/git_job'; // Import the Job class
import fetch from 'cross-fetch'; //node-fetch doesn't work
const GITLAB_URL = 'https://gitlab.com';
const GITLAB_ARTIFACT_TOKEN: string = envCfg.GIT_ACCESS_KEY as string;
const project_id = '42713979'; //oneweb_project_sw_tools
const job_status = 'success';

const headers = {
    'PRIVATE-TOKEN': GITLAB_ARTIFACT_TOKEN
};

export async function GetGitJobs(pageIndex: number, jobs_per_page: number = 20): Promise<GitJob[]> {
    // Jobs per page can max 100 now
    try {
        const url = `${GITLAB_URL}/api/v4/projects/${project_id}/jobs?scope[]=${job_status}&per_page=${jobs_per_page} &page=${pageIndex + 1}`;
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const gitJobs: GitJob[] = data.map((jobData: any) => new GitJob(jobData));
        gitJobs.forEach(element => {
            console.log(`${element.name} at ${element.created_at}`);
        });
        return gitJobs;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}
