import { Repository } from '@prisma/client';
import { GitHubService } from './GitHubService';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import Anthropic from '@anthropic-ai/sdk';

interface AnalysisOptions {
  branch?: string;
  analysisType: 'full' | 'incremental' | 'pr';
  triggeredBy: 'webhook' | 'manual' | 'scheduled';
  userId: string;
}

interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

interface AnalysisMetrics {
  totalLines: number;
  totalFiles: number;
  codeComplexity: number;
  duplicateLines: number;
  testCoverage?: number;
}

interface IssueCount {
  critical: number;
  major: number;
  minor: number;
  suggestions: number;
}

interface ScoreBreakdown {
  overall: number;
  quality: number;
  security: number;
  performance: number;
  maintainability: number;
}

export class AnalysisService {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    this.anthropic = new Anthropic({
      apiKey
    });
  }

  async analyzeRepository(
    repository: Repository,
    githubToken: string,
    options: AnalysisOptions
  ): Promise<string> {
    try {
      logger.info('Starting repository analysis', {
        repositoryId: repository.id,
        fullName: repository.fullName,
        options
      });

      const githubService = new GitHubService(githubToken);

      // Get latest commit info
      const latestCommit = await githubService.getLatestCommit(
        repository.fullName,
        options.branch || repository.defaultBranch || 'main'
      );

      // Collect code files for analysis
      const codeFiles = await this.collectCodeFiles(
        githubService,
        repository.fullName,
        options.branch || repository.defaultBranch || 'main'
      );

      // Calculate basic metrics
      const metrics = this.calculateBasicMetrics(codeFiles);

      // Perform AI analysis
      const aiAnalysis = await this.performAIAnalysis(codeFiles, repository);

      // Calculate scores
      const scores = this.calculateScores(metrics, aiAnalysis.issues);

      // Save analysis result
      const analysisResult = await prisma.analysisResult.create({
        data: {
          repositoryId: repository.id,
          userId: options.userId,
          commitSha: latestCommit.sha,
          branch: options.branch || repository.defaultBranch || 'main',
          analysisType: options.analysisType,
          triggeredBy: options.triggeredBy,
          
          // Scores
          overallScore: scores.overall,
          qualityScore: scores.quality,
          securityScore: scores.security,
          performanceScore: scores.performance,
          maintainabilityScore: scores.maintainability,
          
          // Metrics
          totalLines: metrics.totalLines,
          totalFiles: metrics.totalFiles,
          codeComplexity: metrics.codeComplexity,
          duplicateLines: metrics.duplicateLines,
          testCoverage: metrics.testCoverage,
          
          // Issues
          criticalIssues: aiAnalysis.issues.critical,
          majorIssues: aiAnalysis.issues.major,
          minorIssues: aiAnalysis.issues.minor,
          suggestions: aiAnalysis.issues.suggestions,
          
          // AI results
          detailedResults: aiAnalysis.detailedResults,
          aiInsights: aiAnalysis.insights,
          aiSummary: aiAnalysis.summary
        }
      });

      // Update repository last analyzed time
      await prisma.repository.update({
        where: { id: repository.id },
        data: { lastAnalyzedAt: new Date() }
      });

      logger.info('Repository analysis completed', {
        repositoryId: repository.id,
        analysisId: analysisResult.id,
        overallScore: scores.overall,
        issuesFound: aiAnalysis.issues.critical + aiAnalysis.issues.major + aiAnalysis.issues.minor
      });

      return analysisResult.id;
    } catch (error) {
      logger.error('Repository analysis failed:', error);
      throw error;
    }
  }

  private async collectCodeFiles(
    githubService: GitHubService,
    fullName: string,
    branch: string
  ): Promise<CodeFile[]> {
    const codeFiles: CodeFile[] = [];
    const maxFiles = 100; // Limit for MVP
    const supportedExtensions = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rb', '.php', 
      '.c', '.cpp', '.cs', '.swift', '.kt', '.rs', '.vue', '.sql', '.yaml', '.yml'
    ]);

    try {
      const contents = await githubService.getRepositoryContents(fullName, '', branch);
      await this.traverseDirectory(
        githubService, 
        fullName, 
        branch, 
        contents, 
        codeFiles, 
        maxFiles, 
        supportedExtensions
      );

      logger.debug(`Collected ${codeFiles.length} code files for analysis`);
      return codeFiles;
    } catch (error) {
      logger.error('Failed to collect code files:', error);
      return [];
    }
  }

  private async traverseDirectory(
    githubService: GitHubService,
    fullName: string,
    branch: string,
    contents: any[],
    codeFiles: CodeFile[],
    maxFiles: number,
    supportedExtensions: Set<string>,
    currentPath = ''
  ): Promise<void> {
    if (codeFiles.length >= maxFiles) return;

    const ignoredDirs = new Set([
      'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 
      'vendor', 'target', '__pycache__', '.venv', 'venv'
    ]);

    for (const item of contents) {
      if (codeFiles.length >= maxFiles) break;

      if (item.type === 'dir') {
        if (ignoredDirs.has(item.name)) continue;
        
        try {
          const subContents = await githubService.getRepositoryContents(
            fullName, 
            item.path, 
            branch
          );
          await this.traverseDirectory(
            githubService, 
            fullName, 
            branch, 
            subContents, 
            codeFiles, 
            maxFiles, 
            supportedExtensions, 
            item.path
          );
        } catch (error) {
          // Skip directories we can't access
          continue;
        }
      } else if (item.type === 'file') {
        const ext = item.name.substring(item.name.lastIndexOf('.'));
        
        if (supportedExtensions.has(ext) && item.size < 100000) { // Skip very large files
          try {
            const content = await githubService.getFileContent(fullName, item.path, branch);
            codeFiles.push({
              path: item.path,
              content,
              language: this.detectLanguage(ext),
              size: item.size
            });
          } catch (error) {
            // Skip files we can't read
            continue;
          }
        }
      }
    }
  }

  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rb': 'ruby',
      '.php': 'php',
      '.c': 'c',
      '.cpp': 'cpp',
      '.cs': 'csharp',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.rs': 'rust',
      '.vue': 'vue',
      '.sql': 'sql',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };

    return languageMap[extension] || 'text';
  }

  private calculateBasicMetrics(codeFiles: CodeFile[]): AnalysisMetrics {
    let totalLines = 0;
    let totalComplexity = 0;
    let duplicateLines = 0;
    
    const lineHashes = new Map<string, number>();

    for (const file of codeFiles) {
      const lines = file.content.split('\n');
      totalLines += lines.length;

      // Simple complexity calculation based on control structures
      const complexityPatterns = [
        /\bif\s*\(/g,
        /\bfor\s*\(/g,
        /\bwhile\s*\(/g,
        /\bswitch\s*\(/g,
        /\bcatch\s*\(/g,
        /\?\s*.*\s*:/g // ternary
      ];

      for (const pattern of complexityPatterns) {
        const matches = file.content.match(pattern);
        if (matches) {
          totalComplexity += matches.length;
        }
      }

      // Count duplicate lines (simplified)
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 10) {
          const hash = trimmed;
          const count = lineHashes.get(hash) || 0;
          lineHashes.set(hash, count + 1);
          if (count > 0) {
            duplicateLines++;
          }
        }
      }
    }

    return {
      totalLines,
      totalFiles: codeFiles.length,
      codeComplexity: totalComplexity / Math.max(codeFiles.length, 1),
      duplicateLines
    };
  }

  private async performAIAnalysis(codeFiles: CodeFile[], repository: Repository) {
    try {
      // Prepare code summary for AI analysis
      const codeSummary = this.prepareCodeSummary(codeFiles);

      const prompt = `Analyze this codebase and provide a comprehensive code quality assessment.

Repository: ${repository.fullName}
Language: ${repository.language || 'Multiple'}
Total Files: ${codeFiles.length}

Code Summary:
${codeSummary}

Please analyze the code and provide:

1. Overall assessment (1-10 score)
2. Quality issues found (categorize as critical/major/minor/suggestions)
3. Security vulnerabilities or concerns
4. Performance bottlenecks or inefficiencies  
5. Maintainability concerns
6. Best practices violations
7. Specific recommendations for improvement

Format your response as JSON with the following structure:
{
  "scores": {
    "overall": 8.5,
    "quality": 8.0,
    "security": 9.0,
    "performance": 7.5,
    "maintainability": 8.5
  },
  "issues": [
    {
      "type": "critical|major|minor|suggestion",
      "category": "security|performance|quality|maintainability",
      "file": "path/to/file.js",
      "line": 42,
      "description": "Issue description",
      "recommendation": "How to fix this"
    }
  ],
  "summary": "Brief overall assessment and key findings",
  "insights": {
    "strengths": ["Good error handling", "Clear documentation"],
    "weaknesses": ["Inconsistent naming", "Missing tests"],
    "recommendations": ["Add unit tests", "Implement linting"]
  }
}`;

      const message = await this.anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: prompt
        }]
      });

      const aiResponse = message.content[0];
      if (aiResponse.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      const analysisData = JSON.parse(aiResponse.text);

      // Count issues by severity
      const issueCount: IssueCount = {
        critical: 0,
        major: 0,
        minor: 0,
        suggestions: 0
      };

      for (const issue of analysisData.issues) {
        switch (issue.type) {
          case 'critical':
            issueCount.critical++;
            break;
          case 'major':
            issueCount.major++;
            break;
          case 'minor':
            issueCount.minor++;
            break;
          case 'suggestion':
            issueCount.suggestions++;
            break;
        }
      }

      return {
        issues: issueCount,
        scores: analysisData.scores,
        summary: analysisData.summary,
        insights: analysisData.insights,
        detailedResults: analysisData
      };

    } catch (error) {
      logger.error('AI analysis failed:', error);
      
      // Return fallback analysis
      return {
        issues: { critical: 0, major: 0, minor: 0, suggestions: 1 },
        scores: { overall: 7.0, quality: 7.0, security: 7.0, performance: 7.0, maintainability: 7.0 },
        summary: 'Analysis completed with basic metrics. AI analysis unavailable.',
        insights: {
          strengths: ['Code structure appears organized'],
          weaknesses: ['Detailed analysis unavailable'],
          recommendations: ['Enable AI analysis for detailed insights']
        },
        detailedResults: { error: 'AI analysis failed', fallback: true }
      };
    }
  }

  private prepareCodeSummary(codeFiles: CodeFile[]): string {
    const summary = codeFiles.slice(0, 20).map(file => {
      const lines = file.content.split('\n');
      const preview = lines.slice(0, 20).join('\n');
      
      return `File: ${file.path} (${file.language}, ${lines.length} lines)
${preview}
${lines.length > 20 ? '...' : ''}
---`;
    }).join('\n\n');

    return summary.length > 30000 ? summary.substring(0, 30000) + '...' : summary;
  }

  private calculateScores(metrics: AnalysisMetrics, issues: IssueCount): ScoreBreakdown {
    // Base score calculation with penalties for issues
    let qualityScore = 10.0;
    let securityScore = 10.0;
    let performanceScore = 10.0;
    let maintainabilityScore = 10.0;

    // Apply penalties for issues
    qualityScore -= (issues.critical * 2.0) + (issues.major * 1.0) + (issues.minor * 0.5);
    securityScore -= (issues.critical * 2.5) + (issues.major * 1.2);
    performanceScore -= (issues.critical * 1.5) + (issues.major * 0.8);
    maintainabilityScore -= (issues.critical * 1.8) + (issues.major * 0.9) + (issues.minor * 0.3);

    // Apply complexity penalties
    const complexityPenalty = Math.min(metrics.codeComplexity / 10, 2.0);
    qualityScore -= complexityPenalty;
    maintainabilityScore -= complexityPenalty;

    // Apply duplicate code penalties
    const duplicatePenalty = Math.min(metrics.duplicateLines / metrics.totalLines * 5, 1.5);
    qualityScore -= duplicatePenalty;
    maintainabilityScore -= duplicatePenalty;

    // Ensure scores don't go below 0
    qualityScore = Math.max(0, qualityScore);
    securityScore = Math.max(0, securityScore);
    performanceScore = Math.max(0, performanceScore);
    maintainabilityScore = Math.max(0, maintainabilityScore);

    // Calculate overall score as weighted average
    const overallScore = (
      (qualityScore * 0.3) +
      (securityScore * 0.25) +
      (performanceScore * 0.25) +
      (maintainabilityScore * 0.2)
    );

    return {
      overall: Math.round(overallScore * 10) / 10,
      quality: Math.round(qualityScore * 10) / 10,
      security: Math.round(securityScore * 10) / 10,
      performance: Math.round(performanceScore * 10) / 10,
      maintainability: Math.round(maintainabilityScore * 10) / 10
    };
  }
}