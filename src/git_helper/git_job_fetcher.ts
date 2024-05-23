import { GitJob } from '@src/git_helper/git_job'; // Import the Job class
import { GitRepoInfo } from './git_helper';
import fetch from 'cross-fetch'; //node-fetch doesn't work
const GITLAB_URL = 'https://gitlab.com';
const job_status = 'success';

export async function* GetGitJobsUntilCutoff(
    gitRepoInfo: GitRepoInfo,
    totalMonths: number = 0,
    maxParallelRequests: number = 5,
    pagesPerRequest: number = 40
): AsyncGenerator<GitJob> {
    const cutOffDate = new Date();
    cutOffDate.setMonth(cutOffDate.getMonth() - totalMonths);

    let pageIndex = 0;
    let shouldContinue = true;

    const stopRequestingJobs = () => {
        shouldContinue = false;
    };

    while (shouldContinue) {
        const promises = [];
        for (let i = 0; i < maxParallelRequests && shouldContinue; i++, pageIndex++) {
            promises.push(GetCutoffDateJobs(gitRepoInfo, pageIndex, pagesPerRequest, cutOffDate, stopRequestingJobs));
        }

        const jobBatches = await Promise.all(promises);
        for (const jobs of jobBatches) {
            for (const job of jobs) {
                yield job;
            }
        }
    }
}

async function GetCutoffDateJobs(gitRepoInfo: GitRepoInfo, pageIndex: number, jobsPerRequest: number, cutOffDate: Date, stopRequestingJobs: () => void
): Promise<Array<GitJob>> {
    console.log(`Fetching new Git Jobs page, page id = ${pageIndex}`);
    const pageJobs: Array<GitJob> = await RequestJobs(gitRepoInfo, pageIndex, jobsPerRequest);

    if (pageJobs.length === 0) {
        stopRequestingJobs();
        return [];
    }

    const lastJob = pageJobs[pageJobs.length - 1];
    if (new Date(lastJob.created_at) < cutOffDate) {
        const indexAfterCutOff: number = pageJobs.findIndex(job => new Date(job.created_at) < cutOffDate);
        const isJobBeforeCutOffDate: boolean = indexAfterCutOff !== -1;
        if (isJobBeforeCutOffDate) {
            stopRequestingJobs();
            return pageJobs.slice(0, indexAfterCutOff);
        }
    }

    return pageJobs;
}

async function RequestJobs(gitRepoInfo: GitRepoInfo, pageIndex: number, jobsPerPage: number = 20, timeout_ms = 4000): Promise<GitJob[]> {
    const controller = new AbortController()
    const url = `${GITLAB_URL}/api/v4/projects/${gitRepoInfo.projectId}/jobs?scope[]=${job_status}&per_page=${jobsPerPage}&page=${pageIndex + 1}`;
    const headers = {
        'PRIVATE-TOKEN': gitRepoInfo.accessToken
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
