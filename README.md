# 🎨 AI-Powered Webtoon Translation Tool - Development Guide

A sophisticated Next.js application for translating Korean, Japanese, and Chinese webtoons into fluent English with preserved bubble tag formatting.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Development Scripts](#development-scripts)
- [Database Setup](#database-setup)
- [API Endpoints](#api-endpoints)
- [Key Components](#key-components)
- [Translation Workflow](#translation-workflow)
- [Authentication & Authorization](#authentication--authorization)
- [UI Components & Styling](#ui-components--styling)
- [Quality Assurance](#quality-assurance)
- [Deployment](#deployment)
- [Contributing](#contributing)

## 🎯 Overview

This application provides a professional translation workflow system that enables:

- **Image Upload**: Support for single images and ZIP files with multiple pages
- **Text Extraction**: AI-powered OCR from uploaded images
- **Smart Translation**: Context-aware translation with genre understanding
- **Quality Improvement**: AI-powered suggestions for translation quality
- **Glossary Management**: Series-specific terminology consistency
- **Professional UI**: Modern, responsive design with smooth user experience

## ✨ Features

### Core Translation Features

- 📸 **Multi-format Image Upload** - Drag & drop, ZIP file support
- 🔍 **Advanced Text Extraction** - OCR with high accuracy
- 🤖 **AI-Powered Translation** - Context-aware with genre understanding
- 📝 **Quality Suggestions** - AI-generated improvement recommendations
- 💾 **Translation History** - Version control and rollback capability
- 📚 **Glossary Management** - Series-specific terminology

### Professional Features

- 🔐 **Role-based Access Control** - Admin/Translator permissions
- 📊 **Progress Tracking** - Real-time status indicators
- 🎨 **Modern UI/UX** - Responsive design with dark/light themes
- 🔄 **Auto-save** - Debounced automatic saving
- 📱 **Mobile Friendly** - Works on all devices

### Tag Format Support

- `"..."` = Speech bubbles
- `(...)` = Thought bubbles
- `//` = Connected bubbles
- `[...]` = Narration boxes
- `St:` = Small text
- `Ot:` = Off-panel narration
- `Sfx:` = Sound effects
- `::` = Screaming/emphasis

## 🛠️ Tech Stack

### Frontend

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Headless UI components
- **Framer Motion** - Smooth animations
- **React Hook Form** - Form management with validation

### Backend & Database

- **Supabase** - Backend-as-a-Service (PostgreSQL + Auth + Storage)
- **Server Actions** - Next.js server-side functions

### AI Integration

- **Google Generative AI** - For translation and quality analysis
- **Custom OCR Service** - Text extraction from images

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting (via Tailwind)
- **TypeScript** - Static type checking

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** (preferred) or npm
- **Supabase Account** - For database and authentication
- **Google AI API Key** - For translation services

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd image-to-text
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the required environment variables (see [Environment Setup](#environment-setup))

4. **Run the development server**

   ```bash
   pnpm dev
   # or
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes
│   ├── (main)/              # Main application routes
│   │   ├── admin/           # Admin dashboard
│   │   ├── profile/         # User profile
│   │   ├── series/          # Series management
│   │   ├── translate/       # Translation interface
│   │   └── page.tsx         # Home page
│   ├── api/                 # API routes
│   └── globals.css          # Global styles
├── components/              # Reusable React components
│   ├── auth/               # Authentication components
│   ├── translation/        # Translation workflow components
│   └── ui/                 # Base UI components (shadcn/ui)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility libraries and configurations
│   ├── auth.ts            # Authentication utilities
│   ├── supabase.ts        # Supabase client and helpers
│   └── utils.ts           # General utilities
├── types/                  # TypeScript type definitions
├── utils/                  # Additional utilities
├── supabase/              # Supabase configurations
│   └── migrations/        # Database migrations
├── scripts/               # Build and utility scripts
├── docs/                  # Documentation
├── config/                # Configuration files
└── styles.css            # Additional global styles
```

## 🔧 Environment Setup

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Google AI Configuration
GOOGLE_AI_API_KEY=your_google_ai_api_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: External Service URLs
OCR_SERVICE_URL=your_ocr_service_url
TRANSLATION_SERVICE_URL=your_translation_service_url
```

### Environment Variables Explained

- **NEXT_PUBLIC_SUPABASE_URL**: Your Supabase project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Supabase anonymous/public API key
- **SUPABASE_SERVICE_KEY**: Supabase service role key (server-side only)
- **GOOGLE_AI_API_KEY**: Google Generative AI API key for translations
- **NEXT_PUBLIC_APP_URL**: Your application URL (for production deployment)

## 🎮 Development Scripts

```bash
# Development
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm test:quality     # Run quality checker tests

# Database
pnpm db:generate      # Generate Supabase types
pnpm db:reset         # Reset local database
pnpm db:seed          # Seed database with test data
```

## 🗄️ Database Setup

### Supabase Setup

1. **Create a new Supabase project**
2. **Run migrations** (located in `supabase/migrations/`)
3. **Set up authentication**
   - Enable email authentication
   - Configure RLS (Row Level Security) policies
4. **Configure storage** for image uploads

### Key Database Tables

- **`users`** - User profiles and roles
- **`series`** - Webtoon series information
- **`chapters`** - Chapter data and translations
- **`glossaries`** - Series-specific terminology
- **`translation_history`** - Version control for translations
- **`access_requests`** - User access approval system

### Database Schema Features

- **Row Level Security (RLS)** - Secure data access
- **Real-time subscriptions** - Live updates
- **File storage** - Image and document storage
- **Full-text search** - Fast content searching

## 🔌 API Endpoints

### Internal API Routes (`/api/`)

- **`/api/extract-texts`** - POST - Extract text from uploaded images
- **`/api/quality-checker`** - POST - Analyze and improve translations
- **`/api/apply-quality`** - POST - Apply quality improvements
- **`/api/auth/[...nextauth]`** - Authentication endpoints

### Server Actions

- **Authentication**: `getUserProfile()`, `checkAccess()`, `updateProfile()`
- **Series Management**: `createSeries()`, `updateSeries()`, `deleteSeries()`
- **Translation**: `saveTranslation()`, `getHistory()`, `updateGlossary()`

## 🧩 Key Components

### Translation Workflow

- **`ImageUploader`** - Handle file uploads and processing
- **`TranslationFlowManager`** - Orchestrate translation workflow
- **`TranslationForm`** - Main translation interface
- **`QualityReviewModal`** - Review AI suggestions
- **`GlossaryManager`** - Manage series terminology

### UI Components

- **`Button`**, **`Card`**, **`Dialog`** - Base UI components
- **`DataTable`** - Sortable, filterable tables
- **`Tabs`**, **`Accordion`** - Layout components
- **`Toast`** - Notification system

### Authentication

- **`AccessRequestForm`** - Request translator access
- **`ProfileForm`** - User profile management
- **`RoleGuard`** - Protect routes by role

## 🔄 Translation Workflow

### Step-by-Step Process

1. **Series Selection** - Choose or create a series
2. **Image Upload** - Upload single images or ZIP files
3. **Text Extraction** - AI extracts text from images
4. **Translation** - AI translates with context awareness
5. **Quality Review** - Review and apply AI suggestions
6. **Glossary Update** - Approve new terminology
7. **Final Save** - Store completed translation

### Quality Improvement Process

```typescript
// Example workflow usage
const flowManager = new TranslationFlowManager(
  seriesId,
  chapterId,
  pages,
  selectedSeries
);

// Process translation
const result = await flowManager.processTranslation();

// Apply improvements
const finalText = await flowManager.completeTranslationWorkflow(
  approvedSuggestions,
  rejectedSuggestions,
  approvedGlossaryTerms
);
```

## 🔐 Authentication & Authorization

### User Roles

- **Admin** - Full system access
- **Translator** - Translation and series management
- **Pending** - Waiting for approval

### Access Control

- Route protection with middleware
- Component-level role checking
- Database RLS policies
- API endpoint protection

### Authentication Flow

1. User registration/login
2. Access request submission
3. Admin approval process
4. Role-based feature access

## 🎨 UI Components & Styling

### Design System

- **Tailwind CSS** - Utility-first styling
- **CSS Variables** - Theme customization
- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Mobile-first approach

### Component Library

Based on **shadcn/ui** with customizations:

- Consistent design language
- Accessibility-first components
- TypeScript integration
- Theme-aware styling

### Styling Guidelines

- Use Tailwind utility classes
- Follow component composition patterns
- Maintain consistent spacing (using Tailwind spacing scale)
- Use semantic color tokens

## 🧪 Quality Assurance

### Code Quality

- **TypeScript** - Static type checking
- **ESLint** - Code linting with Next.js rules
- **Prettier** - Consistent code formatting

### Testing Strategy

- **Quality Checker Script** - Custom translation quality tests
- **Component Testing** - Unit tests for key components
- **Integration Testing** - API endpoint testing

### Performance

- **Image Optimization** - Next.js Image component
- **Code Splitting** - Automatic route-based splitting
- **Lazy Loading** - Component-level lazy loading
- **Database Optimization** - Efficient queries and indexing

## 🚀 Deployment

### Production Setup

1. **Environment Configuration**

   ```bash
   # Set production environment variables
   NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

2. **Build and Deploy**
   ```bash
   pnpm build
   pnpm start
   ```

### Recommended Platforms

- **Vercel** - Optimal for Next.js applications
- **Netlify** - Good alternative with easy setup
- **Railway** - Simple deployment with database support

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Authentication configured
- [ ] File storage setup
- [ ] Error monitoring setup
- [ ] Performance monitoring

## 🤝 Contributing

### Development Guidelines

1. **Code Style**

   - Use TypeScript for all new code
   - Follow existing component patterns
   - Write descriptive commit messages

2. **Component Development**

   - Create reusable, composable components
   - Use proper TypeScript types
   - Include proper error handling

3. **Database Changes**
   - Create migrations for schema changes
   - Update type definitions
   - Test with sample data

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Update documentation
6. Submit a pull request

### Code Review Checklist

- [ ] TypeScript types are correct
- [ ] Components are properly tested
- [ ] Error handling is implemented
- [ ] Performance considerations addressed
- [ ] Documentation updated

## 📚 Additional Resources

- **[Translation Flow Documentation](./README_TRANSLATION_FLOW.md)** - Detailed workflow guide
- **[Assistant Documentation](./docs/ASSISTANTS.md)** - AI integration details
- **[Supabase Documentation](https://supabase.com/docs)** - Database and auth
- **[Next.js Documentation](https://nextjs.org/docs)** - Framework reference
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Styling reference

## 📞 Support

For questions or issues:

1. Check existing documentation
2. Search existing issues
3. Create a detailed issue report
4. Contact the development team

---

**Built with ❤️ using Next.js, TypeScript, and Supabase**
