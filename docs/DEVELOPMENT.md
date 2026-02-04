# Development Workflow

This document outlines the development workflow for the Kyarafit project.

## Git Workflow

### Branch Naming Convention
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical fixes for production
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `chore/description` - Maintenance tasks

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following the project's coding standards
   - Add tests for new functionality
   - Update documentation if needed
   - Ensure all tests pass locally

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

4. **Push Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Go to GitHub and create a PR
   - Fill out the PR template
   - Request review from team members
   - Address any feedback

6. **Merge After Approval**
   - Once approved, merge the PR
   - Delete the feature branch
   - Pull latest changes to main

## Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(auth): add OAuth login support
fix(api): resolve CORS issues with mobile app
docs(readme): update deployment instructions
refactor(ui): extract reusable components
```

## Code Standards

### General
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Follow the existing code style

### Frontend (React/Next.js)
- Use TypeScript for type safety
- Prefer functional components with hooks
- Use Tailwind CSS for styling
- Follow React best practices

### Backend (Go)
- Follow Go naming conventions
- Use proper error handling
- Add comprehensive tests
- Document public functions

### Mobile (React Native)
- Use TypeScript
- Follow React Native best practices
- Test on both iOS and Android
- Use Expo SDK features when possible

## Testing

### Before Committing
- Run all tests locally
- Check for linting errors
- Test the feature manually
- Ensure no console errors

### Test Commands
```bash
# Web app
cd web && npm test

# Mobile app
cd mobile && npm test

# Backend
cd backend && go test ./...

# Image service
cd image-service && python -m pytest
```

## Pull Request Guidelines

### Before Creating PR
- [ ] Code follows project standards
- [ ] All tests pass
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Self-review completed

### PR Description
- Clear description of changes
- Link to related issues
- Screenshots for UI changes
- Testing instructions
- Breaking changes noted

### Review Process
- At least one approval required
- Address all feedback
- Keep PRs focused and small
- Update PR if new commits added

## Deployment

### Staging
- Automatic deployment on PR merge to `develop`
- Test thoroughly before production

### Production
- Only merge to `main` after thorough testing
- Use semantic versioning for releases
- Document any breaking changes

## Troubleshooting

### Common Issues
1. **Merge Conflicts**: Resolve locally and push
2. **Failed Tests**: Fix issues before merging
3. **Linting Errors**: Run linter and fix issues
4. **Build Failures**: Check dependencies and configuration

### Getting Help
- Check existing issues on GitHub
- Ask questions in team chat
- Create detailed bug reports
- Provide reproduction steps

## Environment Setup

### Required Tools
- Node.js 18+
- Go 1.21+
- Python 3.11+
- Docker and Docker Compose
- Git

### Local Development
```bash
# Clone repository
git clone <repo-url>
cd Kyarafit

# Install dependencies
./setup.sh

# Start development servers
./start-project.sh
```

## Resources

- [Conventional Commits](https://www.conventionalcommits.org/)
- [React Best Practices](https://react.dev/learn)
- [Go Best Practices](https://golang.org/doc/effective_go.html)
- [React Native Best Practices](https://reactnative.dev/docs/performance)
- [Next.js Documentation](https://nextjs.org/docs)
