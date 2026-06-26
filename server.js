const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// IBM SDKs (loaded dynamically/safely)
let DiscoveryV2;
let IamAuthenticator;
let WatsonXAI;

try {
  DiscoveryV2 = require('ibm-watson/discovery/v2');
  IamAuthenticator = require('ibm-watson/auth').IamAuthenticator;
  WatsonXAI = require('@ibm-cloud/watsonx-ai').WatsonXAI;
} catch (e) {
  console.log("SDK packages not loaded yet, will fallback to mock mode if missing.");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'public', 'docs');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// In-Memory state for mock document indexing
let mockDocuments = [
  {
    id: "procurement-contract-2026",
    filename: "procurement_contract_2026.pdf",
    title: "Global Supply Chain Agreement (2026)",
    type: "Legal",
    pages: [
      {
        page: 1,
        content: "This Global Supply Chain Agreement is entered into by Forensic AI Inc. and Global Tech Corp. The agreement outlines the procurement of advanced raw microchips and logistics support."
      },
      {
        page: 2,
        content: "Section 4.1: Pricing and Payment Terms. The purchaser shall pay a net 30 rate on all invoices. Any late payments will incur a interest rate of 1.5% per month."
      },
      {
        page: 3,
        content: "Section 9.3: Liability Limitation. Forensic AI Inc.'s liability is capped at $5,000,000 for any direct damages. Neither party is liable for indirect or consequential profits loss."
      },
      {
        page: 4,
        content: "Section 12.1: Data Governance. All documents and code execution structures stored in IBM Cloud or Code Engine will adhere strictly to compliance regulations under GDPR and SOC2 Type II."
      }
    ]
  },
  {
    id: "watsonx-integration-manual",
    filename: "watsonx_integration_manual.pdf",
    title: "IBM watsonx.ai Lite Integration Manual",
    type: "Technical",
    pages: [
      {
        page: 1,
        content: "Introduction to IBM watsonx.ai. This manual outlines connection steps using the @ibm-cloud/watsonx-ai Node.js SDK. Lite tiers are hosted serverlessly."
      },
      {
        page: 2,
        content: "RAG Architecture Setup: Watson Discovery acts as the ingestion engine. Text chunks are retrieved, formatted as context, and injected into the Granite prompt template."
      },
      {
        page: 3,
        content: "Lite Tier Limitations: Watson Discovery Lite offers 1 collection and up to 1,000 documents. watsonx.ai Lite provides 25,000 promo tokens per month for testing."
      }
    ]
  }
];

// Helper to determine if credentials are set
function isIbmConfigured() {
  return !!(
    process.env.WATSON_DISCOVERY_APIKEY &&
    process.env.WATSON_DISCOVERY_URL &&
    process.env.WATSON_DISCOVERY_PROJECT_ID &&
    process.env.WATSONX_AI_APIKEY &&
    process.env.WATSONX_AI_PROJECT_ID
  );
}

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
  const configured = isIbmConfigured();
  res.json({
    configured,
    mode: configured ? "Live (IBM Cloud)" : "Local Gateway",
    details: {
      discoveryUrl: process.env.WATSON_DISCOVERY_URL ? "Configured" : "Not Set",
      watsonxUrl: process.env.WATSONX_AI_SERVICE_URL || "https://us-south.ml.cloud.ibm.com",
      modelId: process.env.WATSONX_AI_MODEL_ID || "ibm/granite-3-8b-instruct",
      projectId: process.env.WATSONX_AI_PROJECT_ID ? "Configured" : "Not Set"
    }
  });
});

// 2. Upload Endpoint
app.post('/api/documents', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const newDoc = {
    id: 'doc-' + Date.now(),
    filename: req.file.filename,
    title: req.body.title || req.file.originalname,
    type: req.body.type || 'General',
    pages: [
      {
        page: 1,
        content: `Uploaded Document Content for ${req.body.title || req.file.originalname}. Structured text analysis in process.`
      },
      {
        page: 2,
        content: "Standard operational parameters and service requirements. This page contains detailed compliance metrics and partner verification logs."
      }
    ]
  };

  mockDocuments.push(newDoc);

  // If live IBM credentials are configured, we index to Watson Discovery
  if (isIbmConfigured()) {
    try {
      const discovery = new DiscoveryV2({
        version: '2023-03-31',
        authenticator: new IamAuthenticator({
          apikey: process.env.WATSON_DISCOVERY_APIKEY,
        }),
        serviceUrl: process.env.WATSON_DISCOVERY_URL,
      });

      // Fetch collection ID dynamically from project
      const collectionsRes = await discovery.listCollections({
        projectId: process.env.WATSON_DISCOVERY_PROJECT_ID
      });
      const collections = collectionsRes.result.collections || [];
      if (collections.length === 0) {
        throw new Error("No collections found in your Watson Discovery project. Please create a collection (e.g. by uploading a file or connecting a data source) in the Watson Discovery dashboard.");
      }
      const collectionId = collections[0].collection_id;

      // Upload file directly to Watson Discovery Project Collection
      const fileStream = fs.createReadStream(req.file.path);
      const addFileParams = {
        projectId: process.env.WATSON_DISCOVERY_PROJECT_ID,
        collectionId: collectionId,
        file: fileStream,
        filename: req.file.originalname,
        fileContentType: req.file.mimetype,
      };

      const discResponse = await discovery.addDocument(addFileParams);
      newDoc.discoveryId = discResponse.result.document_id;
      return res.json({
        success: true,
        message: 'File uploaded and indexed successfully in IBM Watson Discovery.',
        document: newDoc,
        discoveryId: discResponse.result.document_id
      });
    } catch (err) {
      console.error('IBM Discovery Indexing Error:', err);
      return res.status(500).json({
        error: 'File saved locally but failed to index in Watson Discovery.',
        details: err.message,
        document: newDoc
      });
    }
  }

  // Fallback to success in Mock Mode
  res.json({
    success: true,
    message: 'File uploaded successfully (Mock Mode Sandbox).',
    document: newDoc
  });
});

// DELETE Document Endpoint
app.delete('/api/documents/:id', async (req, res) => {
  const { id } = req.params;
  const docIndex = mockDocuments.findIndex(d => d.id === id);

  if (docIndex === -1) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const doc = mockDocuments[docIndex];

  // If live IBM credentials are configured, delete from Watson Discovery
  if (isIbmConfigured() && doc.discoveryId) {
    try {
      const discovery = new DiscoveryV2({
        version: '2023-03-31',
        authenticator: new IamAuthenticator({
          apikey: process.env.WATSON_DISCOVERY_APIKEY,
        }),
        serviceUrl: process.env.WATSON_DISCOVERY_URL,
      });

      const collectionsRes = await discovery.listCollections({
        projectId: process.env.WATSON_DISCOVERY_PROJECT_ID
      });
      const collections = collectionsRes.result.collections || [];
      if (collections.length > 0) {
        const collectionId = collections[0].collection_id;
        await discovery.deleteDocument({
          projectId: process.env.WATSON_DISCOVERY_PROJECT_ID,
          collectionId: collectionId,
          documentId: doc.discoveryId,
        });
        console.log(`Successfully deleted document ${doc.discoveryId} from Watson Discovery collection ${collectionId}`);
      } else {
        console.log("No collections found; skipping Watson Discovery document deletion.");
      }
    } catch (err) {
      console.error('IBM Discovery Deletion Error:', err);
    }
  }

  // Delete local file if it exists
  const filePath = path.join(__dirname, 'public', 'docs', doc.filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to delete local file:', err);
    }
  }

  // Remove from mock array
  mockDocuments.splice(docIndex, 1);

  res.json({
    success: true,
    message: 'Document deleted successfully.'
  });
});

// 3. List Documents
app.get('/api/documents', (req, res) => {
  res.json(mockDocuments.map(d => ({
    id: d.id,
    filename: d.filename,
    title: d.title,
    type: d.type,
    pageCount: d.pages.length
  })));
});

// 4. Summarize Document
app.post('/api/summarize', async (req, res) => {
  const { docId } = req.body;
  const doc = mockDocuments.find(d => d.id === docId);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Live IBM Summarization using watsonx.ai
  if (isIbmConfigured()) {
    try {
      const watsonxAIService = new WatsonXAI({
        version: '2024-05-31',
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL,
        authenticator: new IamAuthenticator({
          apikey: process.env.WATSONX_AI_APIKEY
        })
      });

      const fullText = doc.pages.map(p => p.content).join("\n");
      const modelId = process.env.WATSONX_AI_MODEL_ID || 'ibm/granite-3-8b-instruct';

      const prompt = `System: You are CognitiveDoc AI, an intelligent analyzer. Summarize the following document accurately. Keep it under 150 words.
Document:
${fullText}

Summary:`;

      const response = await watsonxAIService.generateText({
        modelId,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        input: prompt,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.3
        }
      });

      const text = response.result.results[0].generated_text.trim();
      return res.json({
        summary: text,
        document: doc.title,
        mode: "Live IBM Cloud"
      });
    } catch (err) {
      console.error('watsonx.ai Summarize Error:', err);
      // Fall through to mock summary if error occurs
    }
  }

  // Mock Mode Summaries
  let summary = "";
  if (doc.id === "procurement-contract-2026") {
    summary = "This agreement governs microchip procurement between Forensic AI Inc. and Global Tech Corp. It details net 30 payment terms with 1.5% interest on late invoices, caps total liability at $5,000,000, and ensures data governance under GDPR and SOC2 compliance hosted on IBM Cloud/Code Engine.";
  } else if (doc.id === "watsonx-integration-manual") {
    summary = "A detailed integration manual outlining the setup of a serverless RAG architecture. It documents connectivity using the @ibm-cloud/watsonx-ai SDK, Watson Discovery ingestion, and Granite prompt engineering under the Free/Lite tier limits.";
  } else {
    summary = `Executive summary of '${doc.title}'. The document contains operations parameters, detailed operational updates, compliance checklists, and verification metrics for the selected division.`;
  }

  res.json({
    summary,
    document: doc.title,
    mode: "Local Integration"
  });
});

// 5. Query Endpoint (RAG pipeline)
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  let passages = [];

  // LIVE MODE: 1. Search Watson Discovery for relevant passages
  if (isIbmConfigured()) {
    try {
      const discovery = new DiscoveryV2({
        version: '2023-03-31',
        authenticator: new IamAuthenticator({
          apikey: process.env.WATSON_DISCOVERY_APIKEY,
        }),
        serviceUrl: process.env.WATSON_DISCOVERY_URL,
      });

      const searchParams = {
        projectId: process.env.WATSON_DISCOVERY_PROJECT_ID,
        query: query,
        count: 3
      };

      const discoveryResponse = await discovery.query(searchParams);
      const results = discoveryResponse.result.results || [];

      passages = results.map((resItem, i) => {
        // Extract content and reference metadata
        const title = resItem.result_metadata?.filename || resItem.metadata?.filename || resItem.title || "Document Source";
        const page = resItem.metadata?.page || 1;
        const text = resItem.document_passages?.[0]?.passage_text || resItem.text?.[0] || "No content extracted.";
        return {
          id: `src-${i}`,
          title,
          page,
          text
        };
      });
    } catch (discoveryErr) {
      console.error('Discovery retrieval error, checking fallback:', discoveryErr);
    }
  }

  // Fallback to Mock Retrieval if search was empty or in mock mode
  if (passages.length === 0) {
    const searchTerms = query.toLowerCase().split(' ');
    // Search local pages
    mockDocuments.forEach(doc => {
      doc.pages.forEach(p => {
        let score = 0;
        searchTerms.forEach(term => {
          if (p.content.toLowerCase().includes(term)) {
            score++;
          }
        });

        if (score > 0) {
          passages.push({
            title: doc.title,
            page: p.page,
            text: p.content,
            score
          });
        }
      });
    });

    // Sort by match score and take top 3
    passages.sort((a, b) => b.score - a.score);
    passages = passages.slice(0, 3);

    // If still no passages, pick default first page
    if (passages.length === 0) {
      passages.push({
        title: mockDocuments[0].title,
        page: mockDocuments[0].pages[0].page,
        text: mockDocuments[0].pages[0].content
      });
    }
  }

  // Build the prompt with context
  const contextBlock = passages.map((p, idx) => `[Source ${idx + 1}: ${p.title}, Page ${p.page}]\nContent: ${p.text}`).join('\n\n');

  // LIVE MODE: 2. Generate answer with watsonx.ai Granite Model
  if (isIbmConfigured()) {
    try {
      const watsonxAIService = new WatsonXAI({
        version: '2024-05-31',
        serviceUrl: process.env.WATSONX_AI_SERVICE_URL,
        authenticator: new IamAuthenticator({
          apikey: process.env.WATSONX_AI_APIKEY
        })
      });

      const prompt = `System: You are CognitiveDoc AI. Answer the query based ONLY on the provided context sources. Use inline citations like [Source 1] or [Source 2] matching the source indices.
Context:
${contextBlock}

Query: ${query}
Answer:`;

      const modelId = process.env.WATSONX_AI_MODEL_ID || 'ibm/granite-3-8b-instruct';
      const genResponse = await watsonxAIService.generateText({
        modelId,
        projectId: process.env.WATSONX_AI_PROJECT_ID,
        input: prompt,
        parameters: {
          max_new_tokens: 300,
          temperature: 0.2
        }
      });

      const generatedAnswer = genResponse.result.results[0].generated_text.trim();
      return res.json({
        answer: generatedAnswer,
        citations: passages.map((p, idx) => ({
          ref: `Source ${idx + 1}`,
          title: p.title,
          page: p.page,
          snippet: p.text
        })),
        mode: "Live IBM Cloud (watsonx.ai)"
      });

    } catch (watsonxErr) {
      console.error('watsonx.ai Generation Error:', watsonxErr);
      // Fall through to mock answer generation
    }
  }

  // Mock Generation logic for a seamless demo
  let answer = "";
  const queryLower = query.toLowerCase();

  if (queryLower.includes('payment') || queryLower.includes('pricing') || queryLower.includes('late')) {
    answer = "According to the procurement contract, the payment terms are net 30 on all invoices. Any late payments will incur a monthly interest rate of 1.5% [Source 1].";
  } else if (queryLower.includes('liability') || queryLower.includes('limit') || queryLower.includes('damage')) {
    answer = "The liability for Forensic AI Inc. is capped at a maximum of $5,000,000 for direct damages under Section 9.3 of the supply agreement. Neither party is held liable for any loss of consequential profits [Source 1].";
  } else if (queryLower.includes('data') || queryLower.includes('governance') || queryLower.includes('gdpr') || queryLower.includes('soc2')) {
    answer = "Data governance parameters require that all documents and code execution structures stored in IBM Cloud or Code Engine adhere strictly to GDPR and SOC2 Type II compliance regulations [Source 1].";
  } else if (queryLower.includes('limit') && queryLower.includes('lite')) {
    answer = "The Watson Discovery Lite tier is limited to 1 collection and a maximum of 1,000 documents. The watsonx.ai Lite tier provides 25,000 promo tokens per month for testing and API validation [Source 2].";
  } else {
    // Generic synthesis based on the context found
    answer = `Based on the matching enterprise documentation: the documents describe details of "${passages[0].text.substring(0, 80)}...". The relevant rules are outlined on page ${passages[0].page} of ${passages[0].title} [Source 1].`;
  }

  res.json({
    answer,
    citations: passages.map((p, idx) => ({
      ref: `Source ${idx + 1}`,
      title: p.title,
      page: p.page,
      snippet: p.text
    })),
    mode: "Local Integration"
  });
});

app.listen(PORT, () => {
  console.log(`CognitiveDoc AI backend listening at http://localhost:${PORT}`);
});
