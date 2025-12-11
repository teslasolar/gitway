/**
 * GitHub Actions Deployment Automation
 * Automates deployment to GitHub Pages with build and test validation
 *
 * Features:
 * - Automatic deployment on push to main branch
 * - Pre-deployment build and test execution
 * - GitHub Pages configuration and updates
 * - Deployment status tracking
 * - Rollback capabilities
 * - Environment variable management
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitHubDeployment {
    constructor(config = {}) {
        this.config = {
            branch: config.branch || 'main',
            buildCommand: config.buildCommand || 'npm run build',
            testCommand: config.testCommand || 'npm test',
            deployDir: config.deployDir || '.',
            githubToken: config.githubToken || process.env.GITHUB_TOKEN,
            repository: config.repository || this.getRepository(),
            skipTests: config.skipTests || false,
            skipBuild: config.skipBuild || false,
            ...config
        };

        this.deploymentHistory = [];
        this.workflowFile = path.join(process.cwd(), '.github', 'workflows', 'deploy.yml');
    }

    /**
     * Get repository info from git remote
     */
    getRepository() {
        try {
            const remote = execSync('git config --get remote.origin.url', {
                encoding: 'utf8'
            }).trim();

            // Parse GitHub URL
            const match = remote.match(/github\.com[:/](.+?)\.git$/);
            if (match) {
                return match[1];
            }

            return null;
        } catch (error) {
            console.error('Failed to get repository:', error.message);
            return null;
        }
    }

    /**
     * Initialize GitHub Pages deployment
     */
    async initialize() {
        console.log('Initializing GitHub Pages deployment...');

        // Create .github/workflows directory
        const workflowDir = path.dirname(this.workflowFile);
        if (!fs.existsSync(workflowDir)) {
            fs.mkdirSync(workflowDir, { recursive: true });
            console.log('Created .github/workflows directory');
        }

        // Check if workflow file exists
        if (fs.existsSync(this.workflowFile)) {
            console.log('Deployment workflow already exists');
            return this.workflowFile;
        }

        // Create enhanced workflow file
        const workflow = this.generateWorkflow();
        fs.writeFileSync(this.workflowFile, workflow);
        console.log('Created deployment workflow:', this.workflowFile);

        return this.workflowFile;
    }

    /**
     * Generate GitHub Actions workflow YAML
     */
    generateWorkflow() {
        return `name: Deploy to GitHub Pages

on:
  push:
    branches: [${this.config.branch}]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  # Build and test job
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: ${this.config.testCommand}
        continue-on-error: ${this.config.skipTests}

      - name: Build project
        run: ${this.config.buildCommand}
        continue-on-error: ${this.config.skipBuild}

      - name: Upload build artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-output
          path: ${this.config.deployDir}
          retention-days: 1

  # Deploy job
  deploy:
    needs: build
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v3
        with:
          name: build-output
          path: ${this.config.deployDir}

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '${this.config.deployDir}'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4

      - name: Deployment Success
        run: |
          echo "Deployment completed successfully!"
          echo "URL: \${{ steps.deployment.outputs.page_url }}"
`;
    }

    /**
     * Run build process
     */
    async build() {
        if (this.config.skipBuild) {
            console.log('Skipping build step');
            return { success: true, skipped: true };
        }

        console.log('Running build...');
        try {
            const output = execSync(this.config.buildCommand, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            console.log('Build completed successfully');
            return { success: true, output };
        } catch (error) {
            console.error('Build failed:', error.message);
            return {
                success: false,
                error: error.message,
                output: error.stdout || error.stderr
            };
        }
    }

    /**
     * Run tests
     */
    async test() {
        if (this.config.skipTests) {
            console.log('Skipping test step');
            return { success: true, skipped: true };
        }

        console.log('Running tests...');
        try {
            const output = execSync(this.config.testCommand, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            console.log('Tests passed successfully');
            return { success: true, output };
        } catch (error) {
            console.error('Tests failed:', error.message);
            return {
                success: false,
                error: error.message,
                output: error.stdout || error.stderr
            };
        }
    }

    /**
     * Deploy to GitHub Pages
     */
    async deploy() {
        console.log('Starting deployment process...');

        const deployment = {
            id: `deploy_${Date.now()}`,
            startTime: new Date(),
            branch: this.getCurrentBranch(),
            commit: this.getCurrentCommit(),
            status: 'in_progress'
        };

        // Verify on correct branch
        if (deployment.branch !== this.config.branch) {
            console.error(`Not on ${this.config.branch} branch (current: ${deployment.branch})`);
            deployment.status = 'failed';
            deployment.error = 'Wrong branch';
            this.deploymentHistory.push(deployment);
            return deployment;
        }

        // Run tests
        const testResult = await this.test();
        if (!testResult.success && !testResult.skipped) {
            console.error('Deployment aborted: Tests failed');
            deployment.status = 'failed';
            deployment.error = 'Tests failed';
            deployment.testOutput = testResult.output;
            this.deploymentHistory.push(deployment);
            return deployment;
        }

        // Run build
        const buildResult = await this.build();
        if (!buildResult.success && !buildResult.skipped) {
            console.error('Deployment aborted: Build failed');
            deployment.status = 'failed';
            deployment.error = 'Build failed';
            deployment.buildOutput = buildResult.output;
            this.deploymentHistory.push(deployment);
            return deployment;
        }

        // Push to GitHub
        try {
            console.log('Pushing to GitHub...');
            execSync('git push origin ' + this.config.branch, {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            deployment.status = 'success';
            deployment.endTime = new Date();
            deployment.duration = deployment.endTime - deployment.startTime;

            console.log('Deployment completed successfully!');
            console.log(`Duration: ${deployment.duration}ms`);
        } catch (error) {
            console.error('Push failed:', error.message);
            deployment.status = 'failed';
            deployment.error = 'Push failed: ' + error.message;
        }

        this.deploymentHistory.push(deployment);
        return deployment;
    }

    /**
     * Get current git branch
     */
    getCurrentBranch() {
        try {
            return execSync('git rev-parse --abbrev-ref HEAD', {
                encoding: 'utf8'
            }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Get current commit hash
     */
    getCurrentCommit() {
        try {
            return execSync('git rev-parse HEAD', {
                encoding: 'utf8'
            }).trim();
        } catch (error) {
            return 'unknown';
        }
    }

    /**
     * Get commit message
     */
    getCommitMessage(commit = 'HEAD') {
        try {
            return execSync(`git log -1 --pretty=%B ${commit}`, {
                encoding: 'utf8'
            }).trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Check deployment status
     */
    async checkStatus() {
        console.log('Checking deployment status...');

        try {
            // Get latest workflow run
            const status = {
                repository: this.config.repository,
                branch: this.getCurrentBranch(),
                commit: this.getCurrentCommit(),
                commitMessage: this.getCommitMessage(),
                workflowExists: fs.existsSync(this.workflowFile),
                lastDeployment: this.deploymentHistory.length > 0 ?
                    this.deploymentHistory[this.deploymentHistory.length - 1] : null
            };

            return status;
        } catch (error) {
            return {
                error: error.message
            };
        }
    }

    /**
     * Rollback to previous deployment
     */
    async rollback(commitHash) {
        console.log(`Rolling back to commit: ${commitHash}`);

        try {
            // Create rollback branch
            execSync(`git checkout -b rollback-${Date.now()} ${commitHash}`, {
                encoding: 'utf8'
            });

            // Push rollback
            execSync('git push origin HEAD:' + this.config.branch + ' --force', {
                encoding: 'utf8'
            });

            console.log('Rollback completed');
            return { success: true, commit: commitHash };
        } catch (error) {
            console.error('Rollback failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get deployment history
     */
    getHistory() {
        return this.deploymentHistory;
    }

    /**
     * Clean up old deployments
     */
    async cleanup() {
        console.log('Cleaning up old deployments...');

        try {
            // Clean npm cache
            execSync('npm cache clean --force', {
                encoding: 'utf8',
                stdio: 'pipe'
            });

            // Clean build artifacts
            if (fs.existsSync('dist')) {
                fs.rmSync('dist', { recursive: true, force: true });
                console.log('Removed dist directory');
            }

            console.log('Cleanup completed');
            return { success: true };
        } catch (error) {
            console.error('Cleanup failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Configure GitHub Pages settings
     */
    async configurePages() {
        console.log('Configuring GitHub Pages...');

        // Create or update _config.yml for Jekyll
        const configPath = path.join(process.cwd(), '_config.yml');
        if (!fs.existsSync(configPath)) {
            const config = `# GitHub Pages Configuration
title: GitWay
description: Ignition SCADA meets GitHub Pages
theme: jekyll-theme-minimal
plugins:
  - jekyll-seo-tag
  - jekyll-sitemap
`;
            fs.writeFileSync(configPath, config);
            console.log('Created _config.yml');
        }

        // Create .nojekyll to bypass Jekyll processing if needed
        const nojekyllPath = path.join(process.cwd(), '.nojekyll');
        if (!fs.existsSync(nojekyllPath)) {
            fs.writeFileSync(nojekyllPath, '');
            console.log('Created .nojekyll');
        }

        return { success: true };
    }

    /**
     * Validate deployment configuration
     */
    validate() {
        const issues = [];

        // Check git repository
        try {
            execSync('git status', { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            issues.push('Not a git repository');
        }

        // Check GitHub remote
        if (!this.config.repository) {
            issues.push('No GitHub repository configured');
        }

        // Check workflow file
        if (!fs.existsSync(this.workflowFile)) {
            issues.push('Deployment workflow not found');
        }

        // Check package.json
        if (!fs.existsSync('package.json')) {
            issues.push('No package.json found');
        }

        return {
            valid: issues.length === 0,
            issues: issues,
            config: this.config
        };
    }

    /**
     * Generate deployment report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            repository: this.config.repository,
            branch: this.config.branch,
            totalDeployments: this.deploymentHistory.length,
            successfulDeployments: this.deploymentHistory.filter(d => d.status === 'success').length,
            failedDeployments: this.deploymentHistory.filter(d => d.status === 'failed').length,
            lastDeployment: this.deploymentHistory.length > 0 ?
                this.deploymentHistory[this.deploymentHistory.length - 1] : null,
            averageDuration: this.calculateAverageDuration(),
            config: this.config
        };

        return report;
    }

    /**
     * Calculate average deployment duration
     */
    calculateAverageDuration() {
        const successful = this.deploymentHistory.filter(d =>
            d.status === 'success' && d.duration
        );

        if (successful.length === 0) {
            return 0;
        }

        const total = successful.reduce((sum, d) => sum + d.duration, 0);
        return Math.round(total / successful.length);
    }
}

// Export
module.exports = GitHubDeployment;

// CLI interface
if (require.main === module) {
    const deploy = new GitHubDeployment();

    const command = process.argv[2];

    switch (command) {
        case 'init':
            deploy.initialize().then(result => {
                console.log('Initialization complete:', result);
            });
            break;

        case 'deploy':
            deploy.deploy().then(result => {
                console.log('Deployment result:', result);
                process.exit(result.status === 'success' ? 0 : 1);
            });
            break;

        case 'status':
            deploy.checkStatus().then(result => {
                console.log('Status:', JSON.stringify(result, null, 2));
            });
            break;

        case 'build':
            deploy.build().then(result => {
                console.log('Build result:', result);
                process.exit(result.success ? 0 : 1);
            });
            break;

        case 'test':
            deploy.test().then(result => {
                console.log('Test result:', result);
                process.exit(result.success ? 0 : 1);
            });
            break;

        case 'validate':
            const validation = deploy.validate();
            console.log('Validation result:', JSON.stringify(validation, null, 2));
            process.exit(validation.valid ? 0 : 1);
            break;

        case 'report':
            const report = deploy.generateReport();
            console.log('Deployment Report:', JSON.stringify(report, null, 2));
            break;

        case 'cleanup':
            deploy.cleanup().then(result => {
                console.log('Cleanup result:', result);
            });
            break;

        case 'configure':
            deploy.configurePages().then(result => {
                console.log('Configuration result:', result);
            });
            break;

        default:
            console.log(`
GitHub Deployment Automation

Usage: node github-deploy.js <command>

Commands:
  init       - Initialize GitHub Pages deployment
  deploy     - Run full deployment (test + build + push)
  build      - Run build process
  test       - Run tests
  status     - Check deployment status
  validate   - Validate deployment configuration
  report     - Generate deployment report
  cleanup    - Clean up build artifacts
  configure  - Configure GitHub Pages settings

Examples:
  node github-deploy.js init
  node github-deploy.js deploy
  node github-deploy.js status
            `);
            break;
    }
}
