import { GitJob } from '@src/git_helper/git_job'; // Import the Job class
import fetch from 'cross-fetch'; //node-fetch doesn't work
const GITLAB_URL = 'https://gitlab.com';
const project_id = '42713979'; //oneweb_project_sw_tools
const job_status = 'success';

export async function GetGitJobsUntilCutoff(git_access_token: string, totalMonths: number = 0, maxParallelRequests = 5, pagesPerRequest = 40): Promise<Array<GitJob>> {
    // Max parallel request high sometimes timeout?
    const cutOffDate = new Date();
    cutOffDate.setMonth(cutOffDate.getMonth() - totalMonths);

    let resultJobs: Array<GitJob> = [];
    let pageIndex = 0;

    let shouldContinue = true;
    const stopRequestingJobs = () => {
        shouldContinue = false;
    };

    while (shouldContinue) {
        const promises = [];
        for (let i = 0; i < maxParallelRequests && shouldContinue; i++, pageIndex++) {
            promises.push(GetCutoffDateJobs(git_access_token, pageIndex, pagesPerRequest, cutOffDate, resultJobs, stopRequestingJobs));
        }
        await Promise.all(promises);
    }

    return resultJobs;
}

async function GetCutoffDateJobs(git_access_token: string, pageIndex: number, jobsPerRequest: number, cutOffDate: Date, resultJobs: Array<GitJob>, stopRequestingJobs: () => void): Promise<Array<GitJob>> {
    console.log(`Fetching new page, page id = ${pageIndex}`);
    const pageJobs: Array<GitJob> = await RequestJobs(git_access_token, pageIndex, jobsPerRequest);
    const lastJob = pageJobs[pageJobs.length - 1];
    if (new Date(lastJob.created_at) < cutOffDate) {
        const indexAfterCutOff = pageJobs.findIndex(job => new Date(job.created_at) >= cutOffDate);
        resultJobs.push(...pageJobs.slice(0, indexAfterCutOff));
        stopRequestingJobs();
    } else {
        resultJobs.push(...pageJobs);
    }
    return pageJobs;
}

async function RequestJobs(git_access_token: string, pageIndex: number, jobsPerPage: number = 20, timeout_ms = 4000): Promise<GitJob[]> {
    const controller = new AbortController()
    const url = `${GITLAB_URL}/api/v4/projects/${project_id}/jobs?scope[]=${job_status}&per_page=${jobsPerPage}&page=${pageIndex + 1}`;
    const headers = {
        'PRIVATE-TOKEN': git_access_token
    };
    const timeout_callback = setTimeout(() => controller.abort(), timeout_ms);
    try {
        const response = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeout_callback);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const gitJobs: GitJob[] = data.map((jobData: any) => new GitJob(jobData));
        return gitJobs;
    }
    catch (error) {
        clearTimeout(timeout_callback);
        throw error; //Don't skip err
    }
}
