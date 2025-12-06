
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copyBtn');
    const csvBtn = document.getElementById('csvBtn');
    const jsonBtn = document.getElementById('jsonBtn');
    const clearBtn = document.getElementById('clearBtn');
    const countSpan = document.getElementById('selectedCount');
    const statusMsg = document.getElementById('statusMsg');

    function showStatus(msg, type = 'success') {
        statusMsg.textContent = msg;
        statusMsg.className = `mt-3 text-center text-sm ${type === 'error' ? 'text-red-400' : 'text-green-400'}`;
        statusMsg.classList.remove('hidden');
        setTimeout(() => {
            statusMsg.classList.add('hidden');
        }, 3000);
    }

    // Initialize count
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, (response) => {
                if (chrome.runtime.lastError) return; // Content script might not be loaded
                if (response && response.count !== undefined) {
                    countSpan.textContent = `${response.count} Selected`;
                }
            });
        }
    });

    // Listen for updates from content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'updateCount') {
            countSpan.textContent = `${message.count} Selected`;
        }
    });

    clearBtn.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: 'clearSelection'});
            countSpan.textContent = '0 Selected';
        });
    });

    copyBtn.addEventListener('click', () => {
        requestData('copy');
    });

    csvBtn.addEventListener('click', () => {
        requestData('csv');
    });

    jsonBtn.addEventListener('click', () => {
        requestData('json');
    });

    function requestData(type) {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (!tabs[0]) {
                 showStatus('No active tab', 'error');
                 return;
            }
            chrome.tabs.sendMessage(tabs[0].id, {action: 'export', type: type}, (response) => {
                if (chrome.runtime.lastError) {
                    showStatus('Content script not ready', 'error');
                    return;
                }
                
                if (response && response.success) {
                    if (type === 'copy') {
                        // Data is in response.data, we need to write it to clipboard here in popup context
                        // because content script might not have focus for clipboard write in some versions
                        // BUT `content.js` usually handles clipboard if triggered by user action.
                        // However, simpler to let content script return string and we write here?
                        // Actually, clipboard write from popup is reliable.
                        navigator.clipboard.writeText(response.data).then(() => {
                            showStatus('Copied to Clipboard!');
                        }).catch(err => {
                            console.error('Failed to copy: ', err);
                            showStatus('Failed to copy', 'error');
                        });
                    } else if (type === 'csv' || type === 'json') {
                         downloadFile(response.data, response.filename, response.mimeType);
                         showStatus('Export started!');
                    }
                } else {
                    showStatus(response.message || 'No videos selected', 'error');
                }
            });
        });
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], {type: mimeType});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
