# ShopSphere — Monolithic E-commerce Application

ShopSphere is a learning project for practising the software delivery lifecycle with a traditional monolithic Node.js application.

## Architecture

- One Node.js/Express application
- One PostgreSQL database
- Server-rendered EJS frontend
- Session-based authentication
- Product catalogue, cart, checkout and order history
- Docker and Docker Compose
- GitHub Actions CI

This is intentionally a **monolith**: the web routes, business logic and application concerns are deployed as one application. PostgreSQL is a separate infrastructure dependency, not a separately deployable business microservice.

## Prerequisites

- Node.js 22+
- npm
- PostgreSQL 16+ (or Docker)
- Git

## Run locally without Docker

1. Copy `.env.example` to `.env` and update `DATABASE_URL`.
2. Install packages:

   ```bash
   npm install
   ```

3. Generate Prisma client and apply migrations:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

4. Seed sample products:

   ```bash
   npm run db:seed
   ```

5. Start the application:

   ```bash
   npm run dev
   ```

6. Visit http://localhost:3000.

## Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

The app container waits for PostgreSQL to become healthy, applies committed migrations, and starts the Node.js server. Seed products once:

```bash
docker compose exec app npm run db:seed
```

Visit http://localhost:3000.

Stop containers:

```bash
docker compose down
```

Remove the local database volume (destructive; deletes local data):

```bash
docker compose down -v
```

## Useful endpoints

- `GET /health` — health check
- `GET /` — product catalogue
- `GET /products/:id` — product details
- `POST /register` — create account
- `POST /login` — sign in
- `GET /cart` — shopping cart
- `POST /checkout` — place order (login required)
- `GET /orders` — order history (login required)

## CI pipeline

GitHub Actions runs on pushes and pull requests targeting `main`. It installs dependencies, generates the Prisma client and runs automated HTTP smoke tests.

## Important learning note

This is a development/learning baseline, not a production-ready commerce system. Before exposing it to the public, add CSRF protection, rate limiting, robust input validation, security headers, structured logging, payment-provider integration, email verification, stronger session/secret management, backups, and production observability. The Compose session secret is a local placeholder and must not be used in production.
