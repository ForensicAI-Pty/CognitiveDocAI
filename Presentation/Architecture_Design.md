# Enterprise Architecture Design: CognitiveDoc AI
**Integration between Microsoft Azure and IBM Cloud**

This document describes the high-level architecture design for CognitiveDoc AI, illustrating how code flows from Azure DevOps into IBM Cloud during development, and how data flows between your deployed application and IBM's AI services at runtime.

---

## 1. High-Level Architecture Overview

CognitiveDoc AI utilizes a **Hybrid Multi-Cloud Architecture**:
* **Azure DevOps (Microsoft)** is used for project management, source control, and the automated CI/CD pipeline (DevOps Layer).
* **IBM Cloud** hosts the serverless runtime and the core AI services (Runtime & AI Layer).

```mermaid
graph TD
    subgraph "1. Microsoft Azure (DevOps & CI/CD)"
        AR[Azure Repos: Git] -->|Triggers Push| AP[Azure Pipelines]
        VG[Variable Group: 'prod'] -.->|Injects Secrets & Keys| AP
    end

    subgraph "2. IBM Cloud (Infrastructure)"
        ICR[IBM Container Registry]
        CE[IBM Code Engine: Serverless Runtime]
    end

    subgraph "3. IBM watsonx Platform (AI Services)"
        WD[Watson Discovery: Vector DB & Search]
        WX[watsonx.ai: Granite-3-8b-instruct LLM]
        COS[Cloud Object Storage: Project Assets]
    end

    AP -->|1. Push Source Code| CE
    AP -->|2. Pull Base & Build Image| ICR
    CE -->|3. Serve UI & API| User((Client Web Browser))
    
    %% Connections
    CE <==>|RAG Queries & Document Indexing| WD
    CE <==>|Generative AI Prompting| WX
    WX <==>|Storage Bucket Link| COS
    WD <==>|Ingestion Storage| COS
```

---

## 2. CI/CD Lifecycle (Azure to IBM Cloud)

This workflow shows how code changes are validated, packaged, and deployed serverlessly without manual intervention.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant AR as Azure Repos (Git)
    participant AP as Azure Pipelines (Agent)
    participant ICR as IBM Container Registry
    participant CE as IBM Code Engine

    Dev->>AR: git push origin main
    AR->>AP: Trigger CI/CD Pipeline
    Note over AP: Step 1: Install Node.js & Dependencies
    Note over AP: Step 2: Verify Server Boots Successfully (Local Mock Mode)
    Note over AP: Step 3: Install IBM Cloud CLI & Plugins
    AP->>ICR: Log in & Prune old/untagged Docker Images (Free up 512MB quota)
    AP->>CE: Deploy App (ibmcloud ce app update --build-source .)
    Note over CE: Code Engine pulls code, triggers buildpack run, creates container image
    CE->>ICR: Push container image
    CE->>CE: Spin up new container with secrets injected (Discovery API keys, Watsonx API keys)
    CE->>CE: Perform Zero-Downtime rolling update (Traffic redirected to new version)
    AP-->>Dev: Pipeline Succeeded (Success Log)
```

---

## 3. RAG Runtime Data Flow (The AI Integration)

When a user interacts with the application, this diagram illustrates how Watson Discovery and watsonx.ai work together to formulate cited answers.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Browser
    participant App as Code Engine Node.js Server
    participant WD as Watson Discovery (V2)
    participant WX as watsonx.ai (Granite LLM)

    %% Upload Flow
    rect rgb(240, 240, 255)
        Note over User, WD: Ingestion (Document Upload)
        User->>App: Upload Document PDF/TXT
        App->>App: Save copy locally
        App->>WD: addDocument() (Pushes binary stream)
        Note over WD: Discovery parses document, performs OCR, extracts text, and indexes it.
        WD-->>App: Return document_id
        App-->>User: File successfully indexed!
    end

    %% RAG query flow
    rect rgb(240, 255, 240)
        Note over User, WX: Retrieval-Augmented Generation (Chat Query)
        User->>App: Post Question (e.g. "What are the liability limits?")
        App->>WD: query() (Semantic Search)
        WD-->>App: Returns Top 3 Text Passages + Source Info (Title, Page #)
        App->>App: Format context block with references
        App->>WX: generateText() (Prompt + Context + Question)
        Note over WX: Granite LLM synthesizes answer using ONLY the context block and inserts inline citations e.g. [Source 1]
        WX-->>App: Returns Generated Answer Text
        App->>App: Parse inline citations to interactive links
        App-->>User: Return Answer + Citations & Source Highlights
    end
```

---

## 4. Resource Directory & Functionalities

Here is a directory of the cloud resources used and their role in the platform.

### Azure Resources (Microsoft)
| Resource / Service | Functionality |
| :--- | :--- |
| **Azure Repos** | Hosts the Git codebase, maintaining version history for frontend code (`public/`) and Node.js backend controller (`server.js`). |
| **Azure Pipelines** | Runs the automated build runner. Executes testing suites (checking if the backend boots locally) and triggers the IBM Cloud CLI build process. |
| **Azure Pipeline Library (Variable Group: `prod`)** | Securely vaults sensitive API keys and IDs (`WATSONX_AI_APIKEY`, `WATSON_DISCOVERY_APIKEY`) and injects them as environment variables during build time. |

### IBM Cloud & watsonx Resources (IBM)
| Resource / Service | Functionality |
| :--- | :--- |
| **IBM Code Engine** | Serverless application hosting environment. It automatically scales containers to zero when idle (saving costs) and scales up instantly when a user visits the app. Handles container image building from raw source code. |
| **IBM Container Registry (ICR)** | Private repository hosting the compiled Docker container images built by Code Engine. |
| **Watson Discovery (Plus Trial)** | Document parsing and semantic vector search engine. Ingests uploaded PDFs, splits them into semantic paragraphs, and returns matches to query inputs. |
| **watsonx.ai (Lite)** | Advanced Generative AI portal. Hosts the `ibm/granite-3-8b-instruct` large language model used to read the matched paragraphs and compile natural answers. |
| **Cloud Object Storage (COS) (Lite)** | Object storage bucket that acts as the physical hard drive for watsonx and Watson Discovery. |
