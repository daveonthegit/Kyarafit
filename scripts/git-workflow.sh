#!/bin/bash

# Kyarafit Git Workflow Helper Script
# This script helps with common Git workflow tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PINK='\033[0;35m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo -e "${BLUE}Kyarafit Git Workflow Helper${NC}"
    echo "=================================="
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  new-feature <name>     Create a new feature branch"
    echo "  new-bugfix <name>      Create a new bugfix branch"
    echo "  new-hotfix <name>      Create a new hotfix branch"
    echo "  commit <message>       Commit changes with conventional format"
    echo "  push                   Push current branch to origin"
    echo "  pr                     Create a pull request (opens GitHub)"
    echo "  finish                 Finish current feature (merge to main)"
    echo "  status                 Show current branch status"
    echo "  sync                   Sync with main branch"
    echo ""
    echo "Examples:"
    echo "  $0 new-feature user-profile"
    echo "  $0 commit \"feat: add user profile page\""
    echo "  $0 push"
    echo "  $0 pr"
}

# Function to create a new branch
create_branch() {
    local type=$1
    local name=$2
    
    if [ -z "$name" ]; then
        echo -e "${RED}❌ Error: Branch name is required${NC}"
        exit 1
    fi
    
    # Ensure we're on main and up to date
    echo -e "${BLUE}🔄 Switching to main branch...${NC}"
    git checkout main
    git pull origin main
    
    # Create new branch
    local branch_name="${type}/${name}"
    echo -e "${BLUE}🌿 Creating new branch: ${branch_name}${NC}"
    git checkout -b "$branch_name"
    
    echo -e "${GREEN}✅ Created and switched to branch: ${branch_name}${NC}"
    echo -e "${YELLOW}💡 You can now start working on your changes${NC}"
}

# Function to commit changes
commit_changes() {
    local message=$1
    
    if [ -z "$message" ]; then
        echo -e "${RED}❌ Error: Commit message is required${NC}"
        echo -e "${YELLOW}💡 Usage: $0 commit \"feat: add new feature\"${NC}"
        exit 1
    fi
    
    # Check if there are changes to commit
    if [ -z "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️  No changes to commit${NC}"
        exit 0
    fi
    
    # Add all changes
    echo -e "${BLUE}📦 Adding changes...${NC}"
    git add .
    
    # Commit with message
    echo -e "${BLUE}💾 Committing changes...${NC}"
    git commit -m "$message"
    
    echo -e "${GREEN}✅ Changes committed successfully${NC}"
}

# Function to push changes
push_changes() {
    local current_branch=$(git branch --show-current)
    
    if [ "$current_branch" = "main" ]; then
        echo -e "${RED}❌ Error: Cannot push directly to main branch${NC}"
        echo -e "${YELLOW}💡 Create a feature branch first${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Pushing branch: ${current_branch}${NC}"
    git push origin "$current_branch"
    
    echo -e "${GREEN}✅ Branch pushed successfully${NC}"
}

# Function to create pull request
create_pr() {
    local current_branch=$(git branch --show-current)
    
    if [ "$current_branch" = "main" ]; then
        echo -e "${RED}❌ Error: Cannot create PR from main branch${NC}"
        exit 1
    fi
    
    # Get repository URL
    local repo_url=$(git config --get remote.origin.url)
    local repo_name=$(basename "$repo_url" .git)
    local owner=$(echo "$repo_url" | sed 's/.*github.com[:/]\([^/]*\)\/.*/\1/')
    
    # Create PR URL
    local pr_url="https://github.com/${owner}/${repo_name}/compare/main...${current_branch}?quick_pull=1"
    
    echo -e "${BLUE}🔗 Opening pull request...${NC}"
    echo -e "${YELLOW}📝 PR URL: ${pr_url}${NC}"
    
    # Try to open in browser
    if command -v open >/dev/null 2>&1; then
        open "$pr_url"
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$pr_url"
    else
        echo -e "${YELLOW}💡 Please open this URL in your browser: ${pr_url}${NC}"
    fi
}

# Function to finish feature
finish_feature() {
    local current_branch=$(git branch --show-current)
    
    if [ "$current_branch" = "main" ]; then
        echo -e "${RED}❌ Error: Already on main branch${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}🔄 Switching to main branch...${NC}"
    git checkout main
    git pull origin main
    
    echo -e "${BLUE}🔀 Merging ${current_branch}...${NC}"
    git merge "$current_branch"
    
    echo -e "${BLUE}🚀 Pushing to main...${NC}"
    git push origin main
    
    echo -e "${BLUE}🗑️  Deleting feature branch...${NC}"
    git branch -d "$current_branch"
    git push origin --delete "$current_branch"
    
    echo -e "${GREEN}✅ Feature completed and merged to main${NC}"
}

# Function to show status
show_status() {
    echo -e "${BLUE}📊 Current Git Status${NC}"
    echo "===================="
    echo ""
    
    local current_branch=$(git branch --show-current)
    echo -e "${YELLOW}Current branch: ${current_branch}${NC}"
    echo ""
    
    echo -e "${BLUE}📝 Status:${NC}"
    git status --short
    echo ""
    
    echo -e "${BLUE}📈 Recent commits:${NC}"
    git log --oneline -5
}

# Function to sync with main
sync_main() {
    local current_branch=$(git branch --show-current)
    
    echo -e "${BLUE}🔄 Syncing with main branch...${NC}"
    git checkout main
    git pull origin main
    
    if [ "$current_branch" != "main" ]; then
        echo -e "${BLUE}🔄 Switching back to ${current_branch}...${NC}"
        git checkout "$current_branch"
        git merge main
    fi
    
    echo -e "${GREEN}✅ Synced with main branch${NC}"
}

# Main script logic
case "$1" in
    "new-feature")
        create_branch "feature" "$2"
        ;;
    "new-bugfix")
        create_branch "bugfix" "$2"
        ;;
    "new-hotfix")
        create_branch "hotfix" "$2"
        ;;
    "commit")
        commit_changes "$2"
        ;;
    "push")
        push_changes
        ;;
    "pr")
        create_pr
        ;;
    "finish")
        finish_feature
        ;;
    "status")
        show_status
        ;;
    "sync")
        sync_main
        ;;
    *)
        usage
        ;;
esac
