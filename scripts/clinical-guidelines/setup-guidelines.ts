#!/usr/bin/env tsx

import { IngestionOrchestrator } from '../../src/services/guidelines/ingestion-orchestrator';
import { EmbeddingService } from '../../src/services/guidelines/embedding-service';
import { GuidelineSearchService } from '../../src/services/guidelines/search-service';

async function setupGuidelines() {
  console.log('🚀 Starting Clinical Guidelines Setup...\n');

  // --embed-only skips ingestion and re-embeds every stored document, as is
  // needed after the embedding model changes.
  const embedOnly = process.argv.includes('--embed-only');

  try {
    // Step 1: Run ingestion for available sources
    if (embedOnly) {
      console.log('📥 Step 1: Skipped (--embed-only)\n');
    } else {
      console.log('📥 Step 1: Ingesting guideline data...');
      const orchestrator = new IngestionOrchestrator();
    
      // Show available sources
      const sources = orchestrator.getAvailableSources();
      console.log('Available sources:');
      sources.forEach(({ source, configured }) => {
        console.log(`  - ${source}: ${configured ? '✅ Configured' : '❌ Not configured'}`);
      });
      console.log();

      // Run ingestion for configured sources
      const ingestionResult = await orchestrator.ingestAll();
      console.log('Ingestion Results:');
      console.log(`  Total documents processed: ${ingestionResult.totalDocumentsProcessed}`);
      console.log(`  Total documents updated: ${ingestionResult.totalDocumentsUpdated}`);
      console.log(`  Success: ${ingestionResult.success ? '✅' : '❌'}`);
    
      if (ingestionResult.errors.length > 0) {
        console.log('  Errors:');
        ingestionResult.errors.forEach(error => console.log(`    - ${error}`));
      }
      console.log();
    }

    // Step 2: Process embeddings
    console.log('🧠 Step 2: Processing embeddings...');
    const embeddingService = new EmbeddingService();
    const embeddingResult = await embeddingService.processAllGuidelines();
    console.log(`  Documents processed: ${embeddingResult.processed}`);
    console.log(`  Errors: ${embeddingResult.errors.length}`);
    
    if (embeddingResult.errors.length > 0) {
      console.log('  Embedding errors:');
      embeddingResult.errors.forEach(error => console.log(`    - ${error}`));
    }
    console.log();

    // Step 3: Verify the setup
    console.log('🔍 Step 3: Verifying setup...');
    const searchService = new GuidelineSearchService();
    const stats = await searchService.getStatistics();
    
    console.log('System Statistics:');
    console.log(`  Total guidelines: ${stats.totalGuidelines}`);
    console.log(`  Last updated: ${stats.lastUpdated}`);
    console.log('  By specialty:');
    Object.entries(stats.bySpecialty).forEach(([specialty, count]) => {
      console.log(`    - ${specialty}: ${count}`);
    });
    console.log('  By source:');
    Object.entries(stats.bySource).forEach(([source, count]) => {
      console.log(`    - ${source}: ${count}`);
    });
    console.log();

    // Step 4: Test search functionality
    console.log('🧪 Step 4: Testing search functionality...');
    
    const testQueries = [
      'diabetes screening',
      'drug interactions',
      'cancer treatment'
    ];

    for (const query of testQueries) {
      try {
        const searchResults = await searchService.combinedSearch(query);
        console.log(`  Query: "${query}"`);
        console.log(`    Semantic results: ${searchResults.semanticResults.length}`);
        console.log(`    Text results: ${searchResults.textResults.length}`);
        console.log(`    Total: ${searchResults.totalResults}`);
      } catch (error) {
        console.log(`  Query: "${query}" - Error: ${error}`);
      }
    }
    console.log();

    console.log('✅ Clinical Guidelines Setup Complete!');
    console.log('\nNext steps:');
    console.log('1. Set up API keys for NICE and other sources (if not already done)');
    console.log('2. Schedule monthly refresh using the ingestion API');
    console.log('3. Integrate with Medical Advisor and Clinical Engine');
    console.log('4. Test the UI components');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupGuidelines();
}

export { setupGuidelines }; 