#!/usr/bin/env python3
"""
Fetch all open issues and PRs across user's repositories and generate a markdown summary.
This script uses the GitHub API to collect open issues and pull requests,
then inserts them into the README template.
"""

import os
import sys
import requests
from datetime import datetime

# Add scripts directory to path for minsert
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python-requirements'))

try:
    import minsert
except ImportError:
    print("ERROR: minsert module not found. Please ensure scripts/python-requirements/minsert.py exists.")
    sys.exit(1)

def get_github_data(token, username):
    """
    Fetch all open issues and PRs across user's public repositories.
    """
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    issues = []
    prs = []
    
    try:
        # Get all open issues across all repos
        issues_url = f'https://api.github.com/search/issues?q=is:open is:issue user:{username}&sort=updated&order=desc&per_page=10'
        issues_response = requests.get(issues_url, headers=headers)
        issues_response.raise_for_status()
        
        for item in issues_response.json().get('items', []):
            issues.append({
                'title': item['title'],
                'repo': item['repository_url'].split('/')[-1],
                'url': item['html_url'],
                'created': item['created_at'],
                'updated': item['updated_at']
            })
        
        # Get all open PRs across all repos
        prs_url = f'https://api.github.com/search/issues?q=is:open is:pr user:{username}&sort=updated&order=desc&per_page=10'
        prs_response = requests.get(prs_url, headers=headers)
        prs_response.raise_for_status()
        
        for item in prs_response.json().get('items', []):
            prs.append({
                'title': item['title'],
                'repo': item['repository_url'].split('/')[-1],
                'url': item['html_url'],
                'created': item['created_at'],
                'updated': item['updated_at']
            })
        
        return issues, prs
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to fetch data from GitHub API: {e}")
        sys.exit(1)

def format_date(date_string):
    """Format GitHub API date string to readable format."""
    try:
        date_obj = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
        return date_obj.strftime('%b %d, %Y')
    except:
        return date_string

def generate_markdown(issues, prs, username):
    """Generate markdown content for issues and PRs section."""
    content = []
    
    # Issues section
    if issues or prs:
        content.append("| Type | Repository | Title | Last Updated |")
        content.append("|------|------------|-------|--------------|")
        
        for issue in issues:
            title = issue['title'].replace('|', '\\|')[:50]  # Escape pipes and truncate
            if len(issue['title']) > 50:
                title += "..."
            content.append(f"| 🐛 Issue | [{issue['repo']}](https://github.com/{username}/{issue['repo']}) | [{title}]({issue['url']}) | {format_date(issue['updated'])} |")
        
        for pr in prs:
            title = pr['title'].replace('|', '\\|')[:50]  # Escape pipes and truncate
            if len(pr['title']) > 50:
                title += "..."
            content.append(f"| ✅ PR | [{pr['repo']}](https://github.com/{username}/{pr['repo']}) | [{title}]({pr['url']}) | {format_date(pr['updated'])} |")
    else:
        content.append("✨ No open issues or pull requests at the moment!")
    
    return "\n".join(content)

def update_readme(issues, prs, username):
    """
    Update README with open issues and PRs data.
    """
    src_dir = os.path.dirname(os.path.abspath(__file__))
    workspace = os.path.dirname(src_dir)
    template_path = os.path.join(workspace, 'templates', 'README-template.md')
    readme_path = os.path.join(workspace, 'README.md')
    
    if not os.path.exists(template_path):
        print(f"ERROR: Template file not found at {template_path}")
        sys.exit(1)
    
    # Generate content
    content_block = generate_markdown(issues, prs, username)
    
    # Read template
    with open(template_path, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    # Insert content using minsert
    try:
        result = minsert.update_section(
            template_content,
            '<!-- start openissuesHERE -->',
            '<!-- end openissuesHERE -->',
            content_block
        )
    except Exception as e:
        print(f"ERROR: Failed to insert content: {e}")
        sys.exit(1)
    
    # Write to README
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f"✅ Successfully updated README.md with {len(issues)} issues and {len(prs)} pull requests")

if __name__ == '__main__':
    # Get GitHub token and username
    token = os.environ.get('GH_TOKEN')
    if not token:
        print("ERROR: GH_TOKEN environment variable not set")
        sys.exit(1)
    
    username = os.environ.get('GITHUB_ACTOR', 'M1XZG')
    
    print(f"📋 Fetching open issues and PRs for {username}...")
    
    # Fetch data
    issues, prs = get_github_data(token, username)
    
    print(f"Found {len(issues)} open issues and {len(prs)} open pull requests")
    
    # Update README
    update_readme(issues, prs, username)
