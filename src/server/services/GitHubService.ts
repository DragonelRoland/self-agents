import { logger } from '../utils/logger';

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  default_branch: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
}

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

export class GitHubService {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Vibecode-Analysis-Platform',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`GitHub API error: ${response.status}`, {
        endpoint,
        error,
        status: response.status
      });
      
      if (response.status === 401) {
        throw new Error('GitHub token is invalid or expired');
      }
      
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded or insufficient permissions');
      }
      
      if (response.status === 404) {
        throw new Error('GitHub resource not found');
      }
      
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getUserRepositories(page = 1, perPage = 100): Promise<GitHubRepository[]> {
    try {
      const repos = await this.makeRequest<GitHubRepository[]>(
        `/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`
      );

      logger.debug(`Fetched ${repos.length} repositories for user`, {
        page,
        perPage
      });

      return repos;
    } catch (error) {
      logger.error('Failed to fetch user repositories:', error);
      throw error;
    }
  }

  async getRepository(repoId: string | number): Promise<GitHubRepository> {
    try {
      // If repoId is a number, fetch by ID, otherwise by full name
      const endpoint = typeof repoId === 'number' || /^\d+$/.test(repoId.toString())
        ? `/repositories/${repoId}`
        : `/repos/${repoId}`;

      const repo = await this.makeRequest<GitHubRepository>(endpoint);

      logger.debug('Fetched repository details', {
        repoId,
        fullName: repo.full_name
      });

      return repo;
    } catch (error) {
      logger.error('Failed to fetch repository:', error);
      throw error;
    }
  }

  async getRepositoryContents(
    fullName: string,
    path = '',
    branch = 'main'
  ): Promise<GitHubContent[]> {
    try {
      const contents = await this.makeRequest<GitHubContent | GitHubContent[]>(
        `/repos/${fullName}/contents/${path}?ref=${branch}`
      );

      // Ensure we return an array
      const contentsArray = Array.isArray(contents) ? contents : [contents];

      logger.debug('Fetched repository contents', {
        fullName,
        path,
        branch,
        itemCount: contentsArray.length
      });

      return contentsArray;
    } catch (error) {
      logger.error('Failed to fetch repository contents:', error);
      throw error;
    }
  }

  async getFileContent(
    fullName: string,
    filePath: string,
    branch = 'main'
  ): Promise<string> {
    try {
      const file = await this.makeRequest<GitHubContent>(
        `/repos/${fullName}/contents/${filePath}?ref=${branch}`
      );

      if (file.type !== 'file' || !file.content) {
        throw new Error('Not a file or content not available');
      }

      // Decode base64 content
      const content = Buffer.from(file.content, 'base64').toString('utf8');

      logger.debug('Fetched file content', {
        fullName,
        filePath,
        branch,
        size: content.length
      });

      return content;
    } catch (error) {
      logger.error('Failed to fetch file content:', error);
      throw error;
    }
  }

  async getCommits(
    fullName: string,
    branch = 'main',
    page = 1,
    perPage = 30
  ): Promise<GitHubCommit[]> {
    try {
      const commits = await this.makeRequest<GitHubCommit[]>(
        `/repos/${fullName}/commits?sha=${branch}&per_page=${perPage}&page=${page}`
      );

      logger.debug('Fetched repository commits', {
        fullName,
        branch,
        commitCount: commits.length
      });

      return commits;
    } catch (error) {
      logger.error('Failed to fetch repository commits:', error);
      throw error;
    }
  }

  async getLatestCommit(fullName: string, branch = 'main'): Promise<GitHubCommit> {
    try {
      const commits = await this.getCommits(fullName, branch, 1, 1);
      
      if (commits.length === 0) {
        throw new Error('No commits found');
      }

      return commits[0];
    } catch (error) {
      logger.error('Failed to fetch latest commit:', error);
      throw error;
    }
  }

  async getRepositoryLanguages(fullName: string): Promise<Record<string, number>> {
    try {
      const languages = await this.makeRequest<Record<string, number>>(
        `/repos/${fullName}/languages`
      );

      logger.debug('Fetched repository languages', {
        fullName,
        languages: Object.keys(languages)
      });

      return languages;
    } catch (error) {
      logger.error('Failed to fetch repository languages:', error);
      throw error;
    }
  }

  async createWebhook(
    fullName: string,
    webhookUrl: string,
    secret: string,
    events = ['push', 'pull_request']
  ): Promise<any> {
    try {
      const webhook = await this.makeRequest(
        `/repos/${fullName}/hooks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'web',
            active: true,
            events,
            config: {
              url: webhookUrl,
              content_type: 'json',
              secret,
              insecure_ssl: '0'
            }
          })
        }
      );

      logger.info('Created GitHub webhook', {
        fullName,
        webhookId: webhook.id,
        events
      });

      return webhook;
    } catch (error) {
      logger.error('Failed to create GitHub webhook:', error);
      throw error;
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.makeRequest('/user');
      return true;
    } catch (error) {
      logger.warn('GitHub token validation failed:', error);
      return false;
    }
  }

  async getRateLimitStatus(): Promise<any> {
    try {
      const rateLimit = await this.makeRequest('/rate_limit');
      return rateLimit;
    } catch (error) {
      logger.error('Failed to fetch rate limit status:', error);
      throw error;
    }
  }
}