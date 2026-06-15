Vehicle Management Module — AI Task Guide

Purpose
- Provide a machine-friendly task list and simple protocol so another AI agent can pick, claim, and complete tasks.

Files
- JSON state: d:\MyProject\SLTSERP\ai-tasks\vehicle_management_ai_tasks.json

How an AI agent should operate
1. Read the JSON file and find the next task using the pick policy.
2. Claim a task: set `status` to `in-progress` and add a one-line `claim` entry in the task's `outputs` (e.g., "claimed by AI-agent-X at 2026-06-15T..."). Commit the change.
3. Implement changes in a feature branch: `feature/vm-task-<id>`.
4. When done, update `status` to `completed`, add links to outputs (files created), and open a PR referencing the task id.

Sample Git workflow (agent-run)

```bash
git checkout -b feature/vm-task-2
# implement work
git add .
git commit -m "vm(task-2): implement domain models"
git push origin feature/vm-task-2
# Open PR via API or CLI and update JSON status to 'completed'
```

Notes
- The JSON is the canonical state. Agents must update it atomically and push commits so humans can track progress.
- If your agent has access to the repo API, prefer updating via Git operations + PRs rather than direct file edits.

If you want, I can also:
- Convert each task into GitHub issues.
- Generate initial code skeletons for the top-priority tasks.
