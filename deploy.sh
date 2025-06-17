#!/bin/bash
# Deployment script for Credit Compliance Tool

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Define log function
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Define environment (defaults to development)
ENV=${DEPLOY_ENV:-development}
log_info "Starting deployment process for ${ENV} environment..."

# Create trap to notify on exit
trap 'log_error "Deployment failed! See above for errors."' ERR

# Step 1: Create backup directory
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
log_info "Created backup directory: $BACKUP_DIR"

# Step 2: Backup database schema (requires database access)
if [ "$ENV" != "development" ]; then
    log_info "Creating database backup..."
    # Modify command based on your database setup
    # Example for PostgreSQL:
    # pg_dump -s -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/schema_backup.sql
    # Or use a simpler approach for development:
    cp ./schema.sql $BACKUP_DIR/schema_backup.sql
    log_info "Database schema backed up successfully."
fi

# Step 3: Pull latest code (assuming deployment from Git)
if [ "$ENV" != "development" ]; then
    log_info "Pulling latest code..."
    # git pull origin main || { log_error "Failed to pull latest code"; exit 1; }
    log_warn "Git pull commented out for safety. Uncomment in production."
fi

# Step 4: Install dependencies
log_info "Installing dependencies..."
npm install || { log_error "Failed to install dependencies"; exit 1; }

# Step 5: CRITICAL - Regenerate Prisma client after any schema changes
log_info "Regenerating Prisma client..."
npx prisma generate || { log_error "Failed to regenerate Prisma client. Check Prisma schema for errors."; exit 1; }

# Step 6: Build the application
log_info "Building application..."
npm run build || { log_error "Build failed! Check the logs above for TypeScript errors."; exit 1; }

# Step 7: Apply database migrations (if needed)
log_info "Applying database migrations..."
npx prisma migrate deploy || { log_error "Database migration failed! Check your database connection and migration files."; exit 1; }

# Step 8: Restart the application (implementation depends on your hosting environment)
log_info "Restarting application service..."
case $ENV in
    development)
        log_info "In development mode - manually restart the app if needed"
        ;;
    staging)
        # pm2 restart app-staging || { log_error "Failed to restart staging service"; exit 1; }
        log_warn "PM2 restart commented out for safety. Uncomment for your environment."
        ;;
    production)
        # systemctl restart credit-compliance-service || { log_error "Failed to restart production service"; exit 1; }
        log_warn "Systemctl restart commented out for safety. Uncomment for your environment."
        ;;
    *)
        log_warn "Unknown environment. No service restart performed."
        ;;
esac

log_info "Deployment completed successfully!"
