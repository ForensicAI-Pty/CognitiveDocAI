# Product One-Pager & Battlecard: CognitiveDoc AI
**AI-Powered Document Intelligence for High-Compliance Sectors**

---

## 1. Executive Summary
CognitiveDoc AI is a Retrieval-Augmented Generation (RAG) platform designed to parse, search, and extract verified insights from unstructured enterprise documents (PDFs, DOCX, TXT). Powered by **IBM Watson Discovery** and **watsonx.ai**, it yields conversational answers with direct source citations, deployed serverlessly on **IBM Code Engine**.

---

## 2. Key Audience & Target Profiles
* **Legal & Contract Teams:** Instantly review terms, liabilities, payment parameters, and clauses across multi-page legal agreements.
* **Banking & Finance Compliance:** Cross-reference operational actions against massive regulatory guidelines (GDPR, regional financial policies).
* **Government & Public Sector:** Search standard operating guidelines (SOPs) and policy manuals securely with strict data privacy.

---

## 3. Product Features & Functionalities
* **Direct Page Citations:** Clickable inline links that map text generations back to the exact source page, preventing hallucinations.
* **Instant Document Summarization:** AI-powered executive abstraction models that summarize a document under 150 words in one click.
* **Knowledge Base Lifecycle Manager:** Upload, search, and delete documents securely from the vector index with integrated APIs.
* **Serverless Architecture:** Scale to zero during idle periods, guaranteeing low operational costs.

---

## 4. System Requirements & Architecture Specifications
* **Runtime Platform:** Node.js 20+ runtime deployed serverlessly via IBM Code Engine.
* **Integration API:** Native IBM Cloud Authenticator (IAM keys) connecting to `discovery/v2` and `@ibm-cloud/watsonx-ai`.
* **CI/CD Pipeline:** Fully automated deployments from Azure Pipelines to IBM Container Registry.
* **Security & Compliance:** Runs inside dedicated private namespaces. All data is protected with encryption-at-rest and strict isolation.

---

## 5. Pricing Tiers
| Tier | Pricing | Ideal For | Document Limit | API Token Limit |
| :--- | :--- | :--- | :--- | :--- |
| **Sandbox (Lite)** | **Free / $0** | PoC & Technical Validation | Up to 1,000 documents | 25,000 tokens / month |
| **Professional** | **$550 / month** | Growth Teams & SMBs | Up to 10,000 documents | 500,000 tokens / month |
| **Enterprise** | **$5,000+ / month** | Enterprise-wide deployment | Unlimited | Custom High-volume limits |
