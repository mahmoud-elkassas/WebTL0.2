# Translation AI Assistants Documentation

This document describes the specialized AI assistants built for the translation workflow using Gemini 1.5 Pro.

## Overview

The application uses Gemini 1.5 Pro to provide specialized assistance at key points in the translation workflow. These assistants are designed to enhance the translation process rather than just provide chat-based support.

## Assistants

### 1. Glossary Management Assistant

**Purpose**: Analyze source text to identify, translate, and categorize terminology for the glossary.

**Usage**:

- Automatically detects potential glossary terms from source text
- Provides accurate translations for detected terms
- Suggests appropriate categories (character, place, ability, item, etc.)
- Returns suggestions in a structured format for review

**Integration Points**:

- After translation to suggest new terms
- During glossary management to categorize existing terms

### 2. Story Context Memory Assistant

**Purpose**: Create rich memory entries from translated chapters to maintain story consistency.

**Usage**:

- Generates concise chapter summaries
- Identifies key events worth remembering
- Creates tags for easy searching and filtering
- Builds up a knowledge base about the series

**Integration Points**:

- After each chapter translation to create memory entries
- When reviewing previous chapters for context

### 3. Memory Filtering Assistant

**Purpose**: Select the most relevant memory entries for the current translation context.

**Usage**:

- Analyzes the current text to be translated
- Finds related memory entries based on characters, plot points, etc.
- Prioritizes recent and important memories
- Provides a focused set of context for translation

**Integration Points**:

- Before translation to prepare relevant context
- When reviewing series history

### 4. Prompt Inspector

**Purpose**: Show and allow editing of the full prompt before sending to Gemini.

**Usage**:

- Displays the system prompt, selected glossary terms, and memory entries
- Allows editing of the system prompt to customize translation behavior
- Provides transparency in the AI decision-making process
- Helps refine prompts for better results

**Integration Points**:

- Before sending text for translation
- When customizing translation style

### 5. Translation Management

**Purpose**: Provide tools for managing translations, including history, versioning, and merging.

**Usage**:

- Maintains version history of translations
- Allows replacing existing translations with new content
- Supports merging translations using different strategies
- Provides context and reference for translators

**Integration Points**:

- When updating existing translations
- When combining partial translations
- When referencing previous translation work

## Implementation Details

### API Calling Pattern

All assistants use a standard pattern for API calls:

```typescript
async function callGeminiAssistant(
  prompt: string,
  role: string,
  maxTokens: number = 500
): Promise<string>;
```

This function handles the API call to Gemini with appropriate error handling and response formatting.

### Response Formats

Each assistant returns structured data:

- **Glossary Management**: JSON with suggested terms, translations, and categories
- **Memory Assistant**: JSON with summary, tags, and key events
- **Memory Filtering**: JSON with IDs of relevant memory entries
- **Prompt Inspector**: Raw text preview of the complete prompt
- **Translation Management**: Versioned translation records with metadata

## Configuration

The assistants can be configured through environment variables:

- `GEMINI_API_KEY`: Your Gemini API key
- `GEMINI_API_URL`: The API endpoint (defaults to the beta endpoint)

## Database Integration

The assistants interact with the following database tables:

- `glossaries`: Stores terminology with translations and categories
- `memory_entries`: Stores chapter summaries, tags, and key events
- `memory_relationships`: Tracks relationships between memory entries
- `translation_prompts`: Stores customized system prompts
- `translation_versions`: Stores version history of translations

### Translation Versioning

The system maintains a complete version history of translations through:

- Recording each version when a translation is updated
- Tracking metadata like creation time and author
- Supporting multiple versioning strategies:
  - Full replacement
  - Append mode
  - Prepend mode
  - Smart merge mode

## UI Components

The following UI components provide interfaces to the assistants:

- `GlossaryAssistant`: Modal for reviewing term suggestions
- `MemoryAssistant`: Interface for managing chapter summaries
- `PromptPreview`: Dialog for inspecting prompts before translation
- `TranslationAssistant`: Sidebar assistant for managing the workflow
- `TranslationHistoryModal`: Interface for selecting and applying translations from history

## Performance Considerations

- API calls are made asynchronously to avoid blocking the UI
- Memory entries are cached and filtered locally when possible
- Response sizes are limited to appropriate token counts
- Translation versions are stored efficiently to minimize database overhead
