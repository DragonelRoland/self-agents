# Vibecode - AI-Powered Code Analysis Platform

**Goal:** Scale to 50k MRR through intelligent code analysis SaaS

## 🚀 Project Overview

Vibecode is an AI-powered code analysis platform that helps development teams improve code quality, security, and maintainability. Built with modern technologies and designed to scale rapidly to $50k Monthly Recurring Revenue.

### Key Features
- 🤖 **AI-Powered Analysis** - Advanced code analysis using Anthropic Claude
- 🔒 **Security Scanning** - Automated vulnerability detection
- 📊 **Detailed Insights** - Comprehensive quality metrics and trends
- 🔗 **GitHub Integration** - Seamless repository connection and webhooks
- 💰 **Subscription Model** - Freemium to enterprise pricing tiers

## 🏗️ Technical Architecture

### Backend Stack
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js with security middleware
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT + GitHub OAuth via Passport
- **AI Engine:** Anthropic Claude API
- **Payments:** Stripe subscriptions
- **Hosting:** Designed for AWS/Docker deployment

### Frontend Stack
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS with custom design system
- **State Management:** React Query + Context API
- **Routing:** React Router v6
- **UI Components:** Custom component library
- **Build:** Vite with hot reload

### Database Schema
- Users, Organizations, Teams
- Repositories and Git provider integration
- Analysis results with AI insights
- Subscription management with usage tracking
- Webhook events and processing

## 💼 Business Model

### Pricing Strategy
- **Free Tier:** 3 repos, 10 analyses/month
- **Starter ($29/mo):** 10 repos, 50 analyses/month
- **Professional ($99/mo):** Unlimited repos, 500 analyses/month
- **Enterprise ($499/mo):** Unlimited everything + premium features

### Revenue Targets
- **Month 1:** $1k MRR (10 customers @ $100 avg)
- **Month 3:** $15k MRR (150 customers @ $100 avg)
- **Month 6:** $50k MRR (500 customers @ $100 avg)

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- PostgreSQL
- Redis (optional, for caching)
- GitHub OAuth App
- Anthropic API Key
- Stripe Account

### Environment Setup

1. **Clone and Install:**
```bash
git clone <repo-url>
cd vibecode
npm install
cd src/client && npm install
```

2. **Environment Variables:**
```bash
cp .env.example .env
# Fill in your API keys and database URLs
```

3. **Database Setup:**
```bash
npx prisma migrate dev
npx prisma db push
```

4. **Development Servers:**
```bash
# Terminal 1 - Backend
npm run server:dev

# Terminal 2 - Frontend  
npm run client:dev

# Or both together
npm run dev
```

## 🗂️ Project Structure

```
vibecode/
├── .agent/                 # Meta information and planning
├── src/
│   ├── server/            # Express.js backend
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth, validation, etc.
│   │   └── utils/         # Database, logging, etc.
│   ├── client/            # React frontend
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   ├── pages/       # Route components  
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   ├── contexts/    # React contexts
│   │   │   └── services/    # API integration
│   └── shared/            # Shared types and utilities
├── prisma/                # Database schema
└── docs/                  # Documentation
```

## 📈 Growth Strategy

### Phase 1: MVP Launch (Weeks 1-4)
- Complete core features and deployment
- Beta user acquisition (50-100 users)
- Product-market fit validation

### Phase 2: Scale Features (Weeks 5-12)
- Advanced analysis features
- Team collaboration tools
- Enterprise sales outreach

### Phase 3: Revenue Growth (Weeks 13-24)
- Content marketing and SEO
- Partner integrations (IDE plugins)
- Referral and affiliate programs

## 🎯 Success Metrics

### Technical KPIs
- Analysis accuracy and performance
- API response times < 200ms
- 99.9% uptime SLA

### Business KPIs  
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (LTV)
- Monthly Active Users (MAU)
- Churn rate < 5%

## 🤝 Contributing

This is a focused SaaS project aiming for rapid growth. Priority areas:

1. **Core Features:** Complete MVP functionality
2. **Performance:** Optimize analysis speed and accuracy  
3. **UI/UX:** Improve user experience and conversion
4. **Growth:** Marketing site and acquisition features

## 📄 License

Private commercial project. All rights reserved.

---

**Built with ❤️ for developers who want better code quality**