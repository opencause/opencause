# Build stage for frontend
FROM node:20-slim AS frontend-build

# Build args for Vite (must be declared before use)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

# Set as env vars for Vite build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /app

# Copy server package files
COPY --chown=node:node server/package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy server source
COPY --chown=node:node server/src/ ./src/

# Copy built frontend
COPY --chown=node:node --from=frontend-build /app/client/dist ./public

# Use non-root user
USER node

# Expose port
EXPOSE 3010

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3010/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start server
CMD ["node", "src/index.js"]
