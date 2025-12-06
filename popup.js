document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('toggleExtractor');
    const countDisplay = document.getElementById('countDisplay');
    const btnCopy = document.getElementById('btnCopy');
    const btnCsv = document.getElementById('btnCsv');
    const btnJson = document.getElementById('btnJson');
    const btnClear = document.getElementById('btnClear');
    const statusMsg = document.getElementById('statusMsg');

    // 1. Initialize State
    chrome.storage.local.get(['ytbExtractorEnabled'], (result) => {
        toggle.checked = !!result.ytbExtractorEnabled;
        updateStatus();
    });

    // 2. Poll for current count when popup is opened
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelected'}, (response) => {
                if (!chrome.runtime.lastError && response) {
                    countDisplay.textContent = response.count || 0;
                }
            });
        }
    });

    // 3. Toggle Handlers
    toggle.addEventListener('change', () => {
        const isEnabled = toggle.checked;
        chrome.storage.local.set({ ytbExtractorEnabled: isEnabled }, () => {
            updateStatus();
            // Notify Content Script
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if(tabs[0]?.id) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        action: 'toggleExtractor', 
                        state: isEnabled 
                    });
                }
            });
        });
    });

    function updateStatus() {
        if (toggle.checked) {
            statusMsg.textContent = 'Active - Click thumbnails';
            statusMsg.classList.add('active');
        } else {
            statusMsg.textContent = 'Disabled';
            statusMsg.classList.remove('active');
        }
    }

    // 4. Export logic
    const handleExport = (type) => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0]?.id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getExportData', format: type }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    statusMsg.innerText = "Error: Please refresh YouTube";
                    return;
                }
                
                if (response.success && response.data) {
                    if (type === 'clipboard') {
                        navigator.clipboard.writeText(response.data).then(() => {
                            showTempMessage("Copied!");
                        });
                    } else {
                        let ext = 'txt';
                        if (type === 'csv') ext = 'csv';
                        else if (type === 'json') ext = 'json';
                        else if (type === 'idm') ext = 'ef2';
                        
                        downloadFile(response.data, `youtube_links.${ext}`, type);
                        showTempMessage(`Saved ${type.toUpperCase()}`);
                    }
                } else if (!response.data || response.data.length === 0) {
                     showTempMessage("No selection!");
                }
            });
        });
    };

    const btnIdm = document.getElementById('btnIdm'); // New button

    // ... (existing listeners)

    btnCopy.addEventListener('click', () => handleExport('clipboard'));
    btnCsv.addEventListener('click', () => handleExport('csv'));
    btnJson.addEventListener('click', () => handleExport('json'));
    btnIdm.addEventListener('click', () => handleExport('idm')); // IDM Listener

    btnClear.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0]?.id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearSelection' }, () => {
                countDisplay.textContent = '0';
                showTempMessage("Cleared");
            });
        });
    });

    // 5. Message Listener for live updates
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'updateCount') {
            countDisplay.textContent = msg.count;
        }
    });

    function showTempMessage(msg) {
        const originalText = statusMsg.textContent;
        statusMsg.textContent = msg;
        setTimeout(() => {
            statusMsg.textContent = originalText;
        }, 1500);
    }

    function downloadFile(content, filename, type) {
        let mimeType = 'text/plain';
        if (type === 'csv') mimeType = 'text/csv';
        else if (type === 'json') mimeType = 'application/json';
        else if (type === 'idm') mimeType = 'text/plain'; // .ef2 is text

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
});
