#!/bin/bash
#
# Release Script for Amber
# Usage: ./scripts/release.sh [patch|minor|major]
#
# This script:
# 1. Ensures clean working directory
# 2. Bumps version in package.json
# 3. Creates git tag
# 4. Pushes changes and tags to GitHub
# 5. Triggers GitHub Actions to build and publish release
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Version bump type required${NC}"
    echo "Usage: ./scripts/release.sh [patch|minor|major]"
    echo ""
    echo "Examples:"
    echo "  ./scripts/release.sh patch  # 0.0.1 → 0.0.2"
    echo "  ./scripts/release.sh minor  # 0.0.1 → 0.1.0"
    echo "  ./scripts/release.sh major  # 0.0.1 → 1.0.0"
    exit 1
fi

TYPE=$1

# Validate type
if [[ ! "$TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}Error: Invalid version bump type: $TYPE${NC}"
    echo "Must be one of: patch, minor, major"
    exit 1
fi

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}Warning: Not on main branch (currently on $CURRENT_BRANCH)${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Ensure clean working directory
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}Error: Working directory not clean${NC}"
    echo "Please commit or stash your changes first:"
    git status -s
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Bump version
echo -e "${YELLOW}Bumping $TYPE version...${NC}"
npm version $TYPE --no-git-tag-version

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}✓ Version bumped to: $NEW_VERSION${NC}"

# Sync version to tauri.conf.json
echo -e "${YELLOW}Syncing tauri.conf.json...${NC}"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
echo -e "${GREEN}✓ tauri.conf.json updated${NC}"

# Sync version to Cargo.toml
echo -e "${YELLOW}Syncing Cargo.toml...${NC}"
sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
echo -e "${GREEN}✓ Cargo.toml updated${NC}"

# Update Cargo.lock
echo -e "${YELLOW}Updating Cargo.lock...${NC}"
(cd src-tauri && cargo update -p app --precise "$NEW_VERSION" 2>/dev/null || cargo generate-lockfile 2>/dev/null || true)

# Commit and tag
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

# Push changes and tags
echo -e "${YELLOW}Pushing to GitHub...${NC}"
git push && git push --tags

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Release $NEW_VERSION created!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. GitHub Actions will build the .dmg (check: https://github.com/amber-sync/amber/actions)"
echo "  2. Release will be published at: https://github.com/amber-sync/amber/releases/tag/v$NEW_VERSION"
echo "  3. Website will automatically show new version"
echo ""
