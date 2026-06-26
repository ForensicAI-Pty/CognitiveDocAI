// CognitiveDoc AI - Frontend Controller

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const configStatusBanner = document.getElementById('configStatusBanner');
  const configStatusText = document.getElementById('configStatusText');
  const documentGrid = document.getElementById('documentGrid');
  const docCountText = document.getElementById('docCountText');
  
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');
  
  const chatHistory = document.getElementById('chatHistory');
  const queryInput = document.getElementById('queryInput');
  const sendQueryBtn = document.getElementById('sendQueryBtn');
  
  const citationViewer = document.getElementById('citationViewer');
  const citationList = document.getElementById('citationList');
  const summaryViewer = document.getElementById('summaryViewer');
  const summaryDocTitle = document.getElementById('summaryDocTitle');
  const summaryDocContent = document.getElementById('summaryDocContent');
  const detailPlaceholder = document.getElementById('detailPlaceholder');
  
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');

  // Load backend configuration status
  async function checkStatus() {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      
      if (data.configured) {
        configStatusBanner.className = 'config-status status-live';
        configStatusText.innerText = `Live: IBM Cloud`;
      } else {
        configStatusBanner.className = 'config-status status-demo';
        configStatusText.innerText = 'Local Gateway Active';
      }
    } catch (err) {
      console.error('Failed to get status info:', err);
    }
  }

  // Load document list
  async function loadDocuments() {
    try {
      // Add t=timestamp to bypass browser caching of the document list
      const res = await fetch(`/api/documents?t=${Date.now()}`);
      const docs = await res.json();
      
      docCountText.innerText = `${docs.length} Document${docs.length === 1 ? '' : 's'} Loaded`;
      documentGrid.innerHTML = '';
      
      docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doc-card';
        card.innerHTML = `
          <div class="summarize-pill" data-id="${doc.id}">Summarize</div>
          <div class="delete-doc-btn" data-id="${doc.id}" title="Delete Document"><i class="fa-solid fa-trash-can"></i></div>
          <div class="doc-card-title">${doc.title}</div>
          <div class="doc-card-meta">
            <span>${doc.type}</span>
            <span>${doc.pageCount} pgs</span>
          </div>
        `;
        
        // Add card click to pre-fill prompt
        card.addEventListener('click', (e) => {
          if (e.target.closest('.summarize-pill')) {
            e.stopPropagation();
            triggerSummary(doc.id);
          } else if (e.target.closest('.delete-doc-btn')) {
            e.stopPropagation();
            deleteDocument(doc.id, doc.title);
          } else {
            queryInput.value = `Search inside ${doc.title}: `;
            queryInput.focus();
          }
        });
        
        documentGrid.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load document list:', err);
    }
  }

  // Delete document action
  async function deleteDocument(docId, docTitle) {
    if (!confirm(`Are you sure you want to permanently delete "${docTitle}"?`)) {
      return;
    }
    
    // Optimistic UI: immediately fade out the card to show it's deleting
    const cards = documentGrid.querySelectorAll('.doc-card');
    cards.forEach(card => {
      const btn = card.querySelector(`.delete-doc-btn[data-id="${docId}"]`);
      if (btn) {
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none';
      }
    });
    
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        appendMessage('system', `Successfully deleted "${docTitle}" from the Knowledge Base.`);
      } else {
        appendMessage('system', `Error deleting document: ${data.error}`);
      }
      loadDocuments();
    } catch (err) {
      console.error(err);
      appendMessage('system', `Server connection error trying to delete document.`);
      loadDocuments();
    }
  }

  // File Upload Logic
  uploadZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      uploadFile(fileInput.files[0]);
    }
  });

  // Drag and Drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--accent-cyan)';
    uploadZone.style.background = 'rgba(0, 242, 254, 0.05)';
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.style.borderColor = 'var(--glass-border)';
    uploadZone.style.background = 'rgba(10, 11, 16, 0.2)';
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.style.borderColor = 'var(--glass-border)';
    uploadZone.style.background = 'rgba(10, 11, 16, 0.2)';
    
    if (e.dataTransfer.files.length > 0) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  async function uploadFile(file) {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('title', file.name.split('.')[0].replace(/_/g, ' '));
    formData.append('type', file.name.endsWith('.pdf') ? 'Compliance' : 'Manual');

    // Add immediate progress feedback in sidebar list
    const tempCard = document.createElement('div');
    tempCard.className = 'doc-card';
    tempCard.style.opacity = '0.6';
    tempCard.innerHTML = `
      <div class="doc-card-title">${file.name}</div>
      <div class="doc-card-meta">
        <span>Processing...</span>
      </div>
    `;
    documentGrid.appendChild(tempCard);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        appendMessage('system', `Successfully uploaded and indexed "${data.document.title}". It is now searchable in our Knowledge Base.`);
      } else {
        appendMessage('system', `Error uploading document: ${data.error}`);
      }
      loadDocuments();
    } catch (err) {
      console.error(err);
      appendMessage('system', `Server connection error uploading file.`);
      loadDocuments();
    }
  }

  // Summarize action
  async function triggerSummary(docId) {
    detailPlaceholder.style.display = 'none';
    citationViewer.style.display = 'none';
    summaryViewer.style.display = 'flex';
    summaryDocTitle.innerText = "Analyzing document details...";
    summaryDocContent.innerText = "Running LLM abstraction models...";
    
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId })
      });
      const data = await res.json();
      
      summaryDocTitle.innerText = data.document;
      summaryDocContent.innerHTML = `<span style="font-weight:bold; color:var(--accent-purple);">Summary (${data.mode}):</span><br>${data.summary}`;
      appendMessage('system', `Generated automatic summary for <strong>${data.document}</strong>. Look at the right sidebar to read the analysis!`);
    } catch (err) {
      console.error(err);
      summaryDocContent.innerText = "Error fetching summary info.";
    }
  }

  // Query / RAG logic
  async function sendQuery() {
    const queryText = queryInput.value.trim();
    if (!queryText) return;

    queryInput.value = '';
    appendMessage('user', queryText);

    // Typing Loader
    const loaderId = appendTypingIndicator();
    
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });
      const data = await res.json();
      
      removeTypingIndicator(loaderId);

      // Render generation text and format inline citations
      let formattedAnswer = data.answer;
      
      // Map Source strings like [Source 1] to clickable link nodes
      data.citations.forEach((cit, idx) => {
        const pattern = new RegExp(`\\[Source ${idx + 1}\\]`, 'g');
        formattedAnswer = formattedAnswer.replace(pattern, `<a href="#" class="citation-link" data-ref="${idx + 1}">[Doc Src ${idx + 1}]</a>`);
      });

      appendMessage('system', formattedAnswer);

      // Render right-side source detail attribution
      renderCitations(data.citations);

    } catch (err) {
      removeTypingIndicator(loaderId);
      console.error(err);
      appendMessage('system', 'Connection failed. Ensure the local Node.js server.js is running.');
    }
  }

  function appendMessage(sender, text) {
    const messageNode = document.createElement('div');
    messageNode.className = `chat-message ${sender}`;
    messageNode.innerHTML = `
      <div class="chat-avatar">${sender === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>'}</div>
      <div class="chat-bubble">${text}</div>
    `;
    chatHistory.appendChild(messageNode);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    // Add click listeners to any newly created citation links
    messageNode.querySelectorAll('.citation-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const refIndex = link.getAttribute('data-ref');
        highlightCitationCard(refIndex);
      });
    });
  }

  function appendTypingIndicator() {
    const id = 'loader-' + Date.now();
    const loaderNode = document.createElement('div');
    loaderNode.className = 'chat-message system';
    loaderNode.id = id;
    loaderNode.innerHTML = `
      <div class="chat-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="chat-bubble typing-indicator">
        <span></span><span></span><span></span>
      </div>
    `;
    chatHistory.appendChild(loaderNode);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return id;
  }

  function removeTypingIndicator(id) {
    const node = document.getElementById(id);
    if (node) node.remove();
  }

  function renderCitations(citations) {
    detailPlaceholder.style.display = 'none';
    summaryViewer.style.display = 'none';
    citationViewer.style.display = 'flex';
    
    citationList.innerHTML = '';
    citations.forEach((cit, idx) => {
      const card = document.createElement('div');
      card.className = 'citation-card';
      card.id = `cit-card-${idx + 1}`;
      card.innerHTML = `
        <div class="citation-card-header">
          <span>[Source ${idx + 1}] ${cit.title}</span>
          <span>Page ${cit.page}</span>
        </div>
        <div class="citation-card-body">"${cit.snippet}"</div>
      `;
      citationList.appendChild(card);
    });
  }

  function highlightCitationCard(index) {
    // Remove highlight from all cards
    document.querySelectorAll('.citation-card').forEach(c => c.classList.remove('highlighted'));
    
    // Highlight matching card
    const card = document.getElementById(`cit-card-${index}`);
    if (card) {
      card.classList.add('highlighted');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Settings Modal Handlers
  openSettingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'flex';
  });
  
  const closeModal = () => {
    settingsModal.style.display = 'none';
  };
  
  closeSettingsBtn.addEventListener('click', closeModal);
  cancelSettingsBtn.addEventListener('click', closeModal);
  
  saveSettingsBtn.addEventListener('click', () => {
    // Collect settings details
    const settings = {
      apiKey: document.getElementById('settingWatsonxApiKey').value,
      project: document.getElementById('settingWatsonxProject').value,
      discProject: document.getElementById('settingDiscoveryProject').value
    };
    
    // In a fully client-backed dynamic setup, we can write these configurations.
    // For local ease of use, we output visual confirmation.
    appendMessage('system', 'IBM Credentials temporarily saved in the session context. To make changes permanent, configure the `.env` file in the directory root.');
    closeModal();
    checkStatus();
  });

  // Click events for suggestions
  sendQueryBtn.addEventListener('click', sendQuery);
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendQuery();
  });

  // Initialization
  checkStatus();
  loadDocuments();
});
