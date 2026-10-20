# Clinical Guidelines Integration

## Overview

The Clinical Guidelines system integrates evidence-based medical guidelines into Foresight CDSS to enhance clinical decision support with up-to-date, authoritative medical knowledge. The system implements a Retrieval-Augmented Generation (RAG) approach using vector embeddings for semantic search.

## Architecture

### Database Schema

The system uses four main tables:

- **`guidelines_docs`**: Stores the full text of clinical guidelines
- **`guideline_vectors`**: Stores vector embeddings for semantic search
- **`guidelines_refresh_log`**: Tracks ingestion and update processes

### Key Components

1. **Ingestion Services**: Fetch and parse guidelines from various sources
2. **Embedding Service**: Creates vector embeddings for semantic search
3. **Search Service**: Provides both text-based and semantic search capabilities
4. **Integration Services**: Connect guidelines to Medical Advisor and Clinical Engine

## Supported Data Sources

### Currently Implemented

1. **USPSTF (US Preventive Services Task Force)**
   - Source: Prevention recommendations
   - Domain: Primary care, preventive medicine
   - Format: JSON API (mock implementation ready for real API)

2. **RxNorm Drug Interactions**
   - Source: NLM RxNav API
   - Domain: Pharmacology, drug interactions
   - Format: JSON REST API

### Planned for Future Implementation

3. **NICE Guidelines (UK)**
   - Domain: Broad clinical guidelines
   - Format: XML API (requires API key)

4. **NCI PDQ Cancer Information**
   - Domain: Oncology
   - Format: HTML scraping from cancer.gov

## Specialties Supported

- Primary Care
- Oncology
- Rheumatology
- Pharmacology
- Cardiology
- Endocrinology
- Neurology
- Pulmonology
- Gastroenterology
- Infectious Disease
- General Medicine

## Installation and Setup

### Prerequisites

1. **Environment Variables**:
   ```bash
   OPENAI_API_KEY=your_openai_key
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Database Migration**:
   ```bash
   # Apply the clinical guidelines schema
   npx supabase db push
   ```

### Initial Setup

Run the setup script to populate initial data:

```bash
pnpm run setup:guidelines
```

This script will:
1. Ingest sample guidelines from configured sources
2. Process vector embeddings (`text-embedding-3-large` at 1536 dimensions)
3. Verify the installation
4. Test search functionality

Documents and search queries must be embedded by the same model. After the
embedding model changes, re-embed every stored document without ingesting again:

```bash
pnpm run setup:guidelines --embed-only
```

## API Endpoints

### Ingestion

- **`POST /api/guidelines/ingest`**: Trigger guideline ingestion
  ```bash
  # Ingest all sources
  curl -X POST /api/guidelines/ingest
  
  # Ingest specific source
  curl -X POST /api/guidelines/ingest -d '{"source": "USPSTF"}'
  ```

- **`GET /api/guidelines/ingest`**: Get available sources

### Embeddings

- **`POST /api/guidelines/embed`**: Process embeddings
  ```bash
  # Process all new guidelines
  curl -X POST /api/guidelines/embed
  
  # Re-embed specific document
  curl -X POST /api/guidelines/embed -d '{"docId": 123}'
  ```

### Search

- **`GET /api/guidelines/search`**: Search guidelines
  ```bash
  # Combined search
  curl "/api/guidelines/search?q=diabetes+screening&specialty=Primary+Care"
  
  # Semantic search only
  curl "/api/guidelines/search?q=diabetes&type=semantic&limit=5"
  
  # Text search only
  curl "/api/guidelines/search?q=diabetes&type=text&limit=10"
  ```

## Usage Examples

### Basic Search

```typescript
import { GuidelineSearchService } from '@/services/guidelines/search-service';

const searchService = new GuidelineSearchService();

// Semantic search for relevant guidelines
const results = await searchService.semanticSearch(
  'diabetes management in elderly patients',
  'Primary Care',
  5
);

// Combined search for comprehensive results
const combined = await searchService.combinedSearch(
  'hypertension treatment',
  'Cardiology'
);
```

### Integration with Medical Advisor

```typescript
import { EmbeddingService } from '@/services/guidelines/embedding-service';

const embeddingService = new EmbeddingService();

// Get relevant guidelines for a clinical question
const guidelines = await embeddingService.searchSimilar(
  'What is the recommended screening age for colorectal cancer?',
  'Primary Care',
  3
);

// Use guidelines to augment GPT prompt
const prompt = `
Based on the following guidelines:
${guidelines.map(g => g.content).join('\n\n')}

Please answer: ${userQuestion}
`;
```

## Data Management

### Refresh Process

The system includes automated refresh capabilities:

1. **Manual Refresh**: Use the ingestion API endpoints
2. **Scheduled Refresh**: Set up monthly cron jobs
3. **Incremental Updates**: Only update changed documents

### Data Quality

- **Deduplication**: Prevents duplicate guidelines
- **Validation**: Ensures data integrity
- **Versioning**: Tracks document updates
- **Error Handling**: Comprehensive logging and error tracking

## Performance Considerations

### Vector Search Optimization

- **Indexing**: Uses IVFFLAT index for fast similarity search
- **Chunking**: Breaks large documents into manageable pieces
- **Batch Processing**: Processes embeddings in batches
- **Caching**: Stores embeddings for repeated use

### Scaling

- **Pagination**: Supports large result sets
- **Filtering**: Efficient specialty-based filtering
- **Rate Limiting**: Respects API rate limits during ingestion

## Integration Points

### Medical Advisor (Tool A)

The Medical Advisor can be enhanced with guidelines by:

1. Adding a specialty filter dropdown
2. Retrieving relevant guidelines based on user queries
3. Augmenting GPT prompts with guideline content
4. Citing sources in responses

### Clinical Engine (Tool B)

The Clinical Engine can use guidelines for:

1. Validating differential diagnoses
2. Suggesting evidence-based treatments
3. Checking drug interactions
4. Generating alerts for guideline deviations

## Monitoring and Maintenance

### Health Checks

- **Data Freshness**: Monitor last update timestamps
- **API Status**: Check external API availability
- **Search Performance**: Monitor query response times
- **Error Rates**: Track ingestion and search failures

### Logs and Analytics

- **Ingestion Logs**: Track data updates in `guidelines_refresh_log`
- **Search Analytics**: Monitor popular queries and specialties
- **Performance Metrics**: Response times and success rates

## Troubleshooting

### Common Issues

1. **Missing API Keys**:
   - Verify environment variables
   - Check API key validity

2. **Embedding Failures**:
   - Verify OpenAI API key
   - Check rate limits
   - Review content length

3. **Search Issues**:
   - Ensure vector indexes are created
   - Verify pgvector extension is enabled
   - Check filter syntax

### Debugging

Enable detailed logging by setting:
```bash
NODE_ENV=development
DEBUG=guidelines:*
```

## Future Enhancements

### Phase Implementation

The system is designed for phased rollout:

- **Phase 1** ✅: Database setup and basic ingestion
- **Phase 2** ✅: Vector search and embeddings
- **Phase 3** 🔄: Medical Advisor integration
- **Phase 4** 📋: Clinical Engine integration
- **Phase 5** 📋: UI components and search interface
- **Phase 6** 📋: Automated refresh system

### Planned Features

- Real-time guideline updates
- Advanced filtering and faceted search
- Guideline recommendation engine
- Integration with FHIR terminology services
- Multi-language support

## Contributing

When adding new guideline sources:

1. Extend the `BaseGuidelineIngester` class
2. Implement source-specific parsing logic
3. Add appropriate specialty mapping
4. Update the orchestrator configuration
5. Add comprehensive tests

## License and Compliance

This system is designed for healthcare applications and should be used in compliance with:

- HIPAA requirements for PHI handling
- Medical device regulations if applicable
- Terms of service for external APIs
- Institutional review board requirements

---

For technical support or questions about implementation, please refer to the development team or create an issue in the project repository. 