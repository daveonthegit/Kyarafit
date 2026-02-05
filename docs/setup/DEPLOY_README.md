# Deployment Guide

This guide covers deploying Kyarafit to various platforms.

## Prerequisites

- Docker and Docker Compose installed
- Git repository with all code
- Environment variables configured
- Database migrations ready

## Local Development

### Quick Start
```bash
# Run the setup script
./setup.sh

# Start all services
docker-compose up
```

### Manual Setup
```bash
# 1. Install dependencies
cd web && npm install
cd ../mobile && npm install
cd ../backend && go mod tidy
cd ../image-service && pip install -r requirements.txt

# 2. Setup environment files
cp web/env.example web/.env
cp mobile/env.example mobile/.env
cp backend/env.example backend/.env
cp image-service/env.example image-service/.env

# 3. Start database
docker-compose up -d postgres

# 4. Setup database schema
cd web && npx prisma db push

# 5. Start services
docker-compose up
```

## Fly.io Deployment

### Setup
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `flyctl auth login`
3. Create apps: `flyctl apps create kyarafit-backend kyarafit-web kyarafit-image-service`

### Deploy
```bash
# Deploy backend
cd backend && flyctl deploy

# Deploy web
cd ../web && flyctl deploy

# Deploy image service
cd ../image-service && flyctl deploy
```

### Environment Variables
Set these in Fly.io dashboard or via CLI:
```bash
flyctl secrets set DATABASE_URL="postgresql://..." -a kyarafit-backend
flyctl secrets set JWT_SECRET="your-secret" -a kyarafit-backend
flyctl secrets set BETTER_AUTH_SECRET="your-secret" -a kyarafit-web
```

## Render Deployment

### Setup
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use the `render.yaml` configuration file

### Services
- **Database**: PostgreSQL (managed)
- **Backend**: Docker service
- **Web**: Docker service  
- **Image Service**: Docker service

### Environment Variables
Set these in Render dashboard:
- `DATABASE_URL` (auto-generated from database)
- `JWT_SECRET` (generate secure random string)
- `BETTER_AUTH_SECRET` (generate secure random string)
- `BETTER_AUTH_URL` (your web app URL)

## Environment Variables

### Required for All Services
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token signing
- `BETTER_AUTH_SECRET`: Secret for BetterAuth

### Backend Specific
- `PORT`: Server port (default: 8080)
- `HOST`: Server host (default: 0.0.0.0)
- `IMAGE_SERVICE_URL`: URL to image processing service

### Web Specific
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_IMAGE_SERVICE_URL`: Image service URL
- `NEXT_PUBLIC_APP_URL`: Web app URL

### Image Service Specific
- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8001)
- `UPLOAD_DIR`: Directory for uploads
- `PROCESSED_DIR`: Directory for processed images

## Database Setup

### Local Development
```bash
# Start PostgreSQL
docker-compose up -d postgres

# Run migrations
cd web && npx prisma db push
```

### Production
1. Create managed PostgreSQL database
2. Set `DATABASE_URL` environment variable
3. Run migrations on first deploy

## Monitoring

### Health Checks
- Backend: `GET /health`
- Image Service: `GET /health`
- Web: `GET /`

### Logs
- Fly.io: `flyctl logs -a <app-name>`
- Render: Available in dashboard

## Troubleshooting

### Common Issues
1. **Database Connection**: Check `DATABASE_URL` format
2. **JWT Errors**: Verify `JWT_SECRET` matches across services
3. **CORS Issues**: Check allowed origins in backend
4. **Build Failures**: Ensure all dependencies are installed

### Debug Commands
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs <service-name>

# Test database connection
docker-compose exec postgres psql -U kyarafit -d kyarafit -c "SELECT 1;"
```

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secrets**: Use strong, unique secrets
3. **Database**: Use connection pooling in production
4. **HTTPS**: Always use HTTPS in production
5. **CORS**: Configure allowed origins properly

## Scaling

### Horizontal Scaling
- Use load balancers for multiple instances
- Implement database connection pooling
- Use Redis for session storage

### Vertical Scaling
- Increase memory/CPU for services
- Optimize database queries
- Use CDN for static assets

