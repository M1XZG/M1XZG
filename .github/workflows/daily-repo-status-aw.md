--- 
on: 
  schedule:
    - cron: "30 7 * * *"
 
permissions: 
  contents: read 
  issues: read 
  pull-requests: read 
 
safe-outputs: 
  create-issue: 
    title-prefix: "[repo status] " 
    labels: [report] 
    assignees: m1xzg
 
tools: 
  github: 
---  
 
# Daily Repo Status Report 
 
Create a daily status report for maintainers. 

Start the report with a random positive thought of the day or inspirational quote from someone. This should NOT be work related.

Include 
- Recent activity in all of my active public repositories (issues, PRs, code changes) 
- Total and exact number of commits, issues, PR' across all active repos, no shortcuts
- Progress tracking, goal reminders and highlights 
- Project status and recommendations 
- Actionable next steps for maintainers 
- Show repository sizes including lfs

Keep it concise and link to the relevant issues/PRs.
