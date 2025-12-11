/**
 * Task Manager - Self-destructing task system
 * Auto-removes completed tasks and organizes plans
 */

const fs = require('fs').promises;
const path = require('path');

class TaskManager {
    constructor() {
        this.planDir = path.join(__dirname);
        this.archiveDir = path.join(this.planDir, 'archive');
        this.planFiles = [];
    }

    async init() {
        // Ensure archive directory exists
        await fs.mkdir(this.archiveDir, { recursive: true });

        // Find all plan.md files
        await this.findPlanFiles(this.planDir);
    }

    async findPlanFiles(dir) {
        const files = await fs.readdir(dir, { withFileTypes: true });

        for (const file of files) {
            const filePath = path.join(dir, file.name);

            if (file.isDirectory() && file.name !== 'archive') {
                await this.findPlanFiles(filePath);
            } else if (file.name === 'plan.md') {
                this.planFiles.push(filePath);
            }
        }
    }

    async processPlan(planPath) {
        let content = await fs.readFile(planPath, 'utf8');
        const originalContent = content;

        // Extract completed tasks
        const completedTasks = [];
        const lines = content.split('\n');
        const newLines = [];

        let inCompletedSection = false;

        for (const line of lines) {
            // Check for completed task
            if (line.match(/^- \[x\]/i)) {
                completedTasks.push(line);
                // Skip completed task (self-destruct)
                continue;
            }

            // Update timestamp
            if (line.includes('{{timestamp}}')) {
                newLines.push(line.replace('{{timestamp}}', new Date().toISOString()));
            } else {
                newLines.push(line);
            }
        }

        // Archive completed tasks if any
        if (completedTasks.length > 0) {
            await this.archiveTasks(planPath, completedTasks);
        }

        // Write updated content
        if (originalContent !== newLines.join('\n')) {
            await fs.writeFile(planPath, newLines.join('\n'));
            console.log(`✓ Processed ${path.basename(path.dirname(planPath))}/plan.md`);
            console.log(`  Removed ${completedTasks.length} completed tasks`);
        }

        return completedTasks.length;
    }

    async archiveTasks(planPath, tasks) {
        const date = new Date().toISOString().split('T')[0];
        const archivePath = path.join(
            this.archiveDir,
            `${path.basename(path.dirname(planPath))}-${date}.md`
        );

        const archiveContent = [
            `# Archived Tasks - ${date}`,
            `Source: ${path.relative(this.planDir, planPath)}`,
            '',
            ...tasks,
            ''
        ].join('\n');

        // Append to archive file
        try {
            const existing = await fs.readFile(archivePath, 'utf8');
            await fs.writeFile(archivePath, existing + '\n' + archiveContent);
        } catch {
            await fs.writeFile(archivePath, archiveContent);
        }
    }

    async updateProgress() {
        // Count tasks across all plans
        let totalTodo = 0;
        let totalDone = 0;

        for (const planPath of this.planFiles) {
            const content = await fs.readFile(planPath, 'utf8');
            totalTodo += (content.match(/^- \[ \]/gm) || []).length;
            totalDone += (content.match(/^- \[x\]/gmi) || []).length;
        }

        // Update master plan progress
        const masterPlan = path.join(this.planDir, 'plan.md');
        let masterContent = await fs.readFile(masterPlan, 'utf8');

        // Update progress section
        const progressLines = [
            '## 📊 Progress',
            `- Total Tasks: ${totalTodo + totalDone}`,
            `- Completed: ${totalDone} (${Math.round(totalDone/(totalTodo+totalDone)*100)}%)`,
            `- Remaining: ${totalTodo}`,
            `- Last Cleanup: ${new Date().toLocaleString()}`
        ];

        masterContent = masterContent.replace(
            /## 📊 Progress[\s\S]*?(?=\n---|\n##|$)/,
            progressLines.join('\n') + '\n'
        );

        await fs.writeFile(masterPlan, masterContent);
    }

    async run() {
        console.log('🧹 Task Manager - Cleaning plans...');
        await this.init();

        let totalRemoved = 0;
        for (const planPath of this.planFiles) {
            totalRemoved += await this.processPlan(planPath);
        }

        await this.updateProgress();

        console.log(`✅ Complete! Removed ${totalRemoved} completed tasks`);
        console.log(`📁 Archives saved to ${this.archiveDir}`);
    }
}

// Run if called directly
if (require.main === module) {
    const manager = new TaskManager();
    manager.run().catch(console.error);
}

module.exports = TaskManager;