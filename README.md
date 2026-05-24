# Jemacash Backend

NestJS + PostgreSQL + TypeORM backend for the Jemacash loan platform.

## Requirements

- Node.js 20+
- PostgreSQL 14+

## Setup

```bash
# 1. Copy and edit env
cp .env.example .env

# 2. Create the database
createdb jemacash

# 3. Start in dev mode (TypeORM synchronize=true creates tables automatically)
npm run start:dev
```

Server starts on `http://localhost:3000`.

## API Reference

### Auth (no token required)
| Method | Path | Body |
|--------|------|------|
| POST | /auth/register | `{ full_name, email, password, phone? }` |
| POST | /auth/login | `{ identifier, password }` |
| POST | /auth/refresh | `{ refresh_token }` |
| POST | /auth/logout | `{ refresh_token }` |
| GET  | /auth/me | — (Bearer token required) |

All protected endpoints require `Authorization: Bearer <access_token>`.

### Applications
| Method | Path | Notes |
|--------|------|-------|
| GET  | /applications | List user's applications |
| POST | /applications | Create draft: `{ amount, term_months, guarantee_id? }` |
| GET  | /applications/:id | Get single application |
| POST | /applications/:id/submit | Submit draft → triggers evaluation |

### Evaluation
| Method | Path | Notes |
|--------|------|-------|
| GET   | /applications/:id/evaluation | Get evaluation |
| PATCH | /applications/:id/evaluation | `{ status: "approved"\|"rejected", approved_amount?, risk_score?, notes? }` |

### Signature
| Method | Path | Notes |
|--------|------|-------|
| POST | /applications/:id/signature | `{ signature_base64, document_urls? }` |
| GET  | /applications/:id/signature | Get signature |

### Guarantees
| Method | Path | Notes |
|--------|------|-------|
| GET  | /guarantees | List user's guarantees |
| POST | /guarantees | `{ type, name, description?, estimated_value }` |

## Business Flow

```
POST /auth/register
  → POST /applications                       (status: draft)
  → POST /applications/:id/submit            (status: submitted, evaluation created)
  → PATCH /applications/:id/evaluation       (status: approved → application = approved)
  → POST /applications/:id/signature         (status: signed)
```

## Token Lifecycle

- **Access token**: 15 min, HS256 (`JWT_SECRET`)
- **Refresh token**: 30 days, HS256 (`JWT_REFRESH_SECRET`), session stored in DB
- Refresh rotates: each `/auth/refresh` issues new pair + invalidates old session

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
