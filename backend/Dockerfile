FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod ./
COPY go.sum* ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Verify migrations exist in builder
RUN ls -la migrations/ || echo "WARNING: Migrations not found in builder!"

# Build the application (full API: health, closet, builds, conventions, etc.)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates wget

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy migrations directory with all contents
COPY --from=builder /app/migrations ./migrations

# Verify migrations were copied correctly
RUN echo "=== Checking migrations ===" && \
    ls -la ./migrations && \
    echo "=== Migration files count ===" && \
    ls -1 ./migrations/*.sql | wc -l && \
    echo "=== First few migration files ===" && \
    ls -1 ./migrations/*.sql | head -5

# Expose port
EXPOSE 8080

# Run the application
CMD ["./main"]
