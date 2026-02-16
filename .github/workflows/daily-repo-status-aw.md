--- 
on: 
  schedule: daily 
 
permissions: 
  contents: read 
  issues: read 
  pull-requests: read 
 
safe-outputs: 
  create-issue: 
    title-prefix: "[repo status] " 
    labels: [report] 
 
tools: 
  github: 
---  
 
# Daily Repo Status Report 
 
Create a daily status report for maintainers. 
 
Include 
- Recent repository activity (issues, PRs, discussions, releases, code changes) 
- Total number of commits, issues, PR' across all active repos
- Progress tracking, goal reminders and highlights 
- Project status and recommendations 
- Actionable next steps for maintainers 
 
Keep it concise and link to the relevant issues/PRs.
