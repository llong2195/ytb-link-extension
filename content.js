// YouTube Link Extractor - Content Script (Clean & Fixed)

let isEnabled = false;
let selectedVideos = new Map(); 
let observer = null;

// --- Initialization ---

function init() {
    // console.log('[YTB] Content script loaded');
    chrome.storage.local.get(['ytbExtractorEnabled'], (result) => {
        if (result.ytbExtractorEnabled) {
            enableExtractor();
        }
    });
}

// --- Core Logic ---

function enableExtractor() {
    if (isEnabled) return;
    isEnabled = true;
    console.log('[YTB Extractor] ENABLED');

    // Debounce timeout
    let processingTimeout = null;
    
    observer = new MutationObserver((mutations) => {
        if (!isEnabled) return;
        
        let shouldProcess = false;
        for(const m of mutations) {
            if (m.addedNodes.length > 0 || m.removedNodes.length > 0) {
                shouldProcess = true;
                break;
            }
        }
        
        if (shouldProcess) {
            // Clear previous timeout to debounce
            if (processingTimeout) clearTimeout(processingTimeout);
            
            processingTimeout = setTimeout(() => {
                processPage();
                processingTimeout = null;
            }, 500);
        }
    });
    
    // Observe entire body with childList and subtree
    // This catches all dynamic content changes including infinite scroll
    observer.observe(document.body, { 
        childList: true, 
        subtree: true 
    });
    
    // Initial Scan
    processPage();
}

function disableExtractor() {
    isEnabled = false;
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    const checkboxes = document.querySelectorAll('.yt-extractor-checkbox');
    checkboxes.forEach(el => el.remove());
    document.querySelectorAll('[data-ytb-processed]').forEach(el => delete el.dataset.ytbProcessed);
    console.log('[YTB Extractor] DISABLED');
}

/**
 * Main processing function.
 * Handles both standard videos and Shorts grid items.
 */
function processPage() {
    // Selectors for high-level item containers
    const itemSelectors = [
        'ytd-rich-item-renderer', 
        'ytd-video-renderer', 
        'ytd-grid-video-renderer', 
        'ytd-compact-video-renderer',
        'ytd-reel-item-renderer'
    ];
    
    const items = document.querySelectorAll(itemSelectors.join(','));
    let newItemsCount = 0;

    items.forEach(item => {
        let videoId = null;
        let injectionTarget = null;
        
        // 1. Try Standard Video (ytd-thumbnail)
        const stdThumbnail = item.querySelector('ytd-thumbnail, ytd-playlist-thumbnail');
        if (stdThumbnail) {
             const anchor = stdThumbnail.querySelector('a#thumbnail');
             if (anchor && anchor.href) {
                 const extractedId = extractVideoId(anchor.href);
                 if (extractedId) {
                     videoId = extractedId;
                     injectionTarget = stdThumbnail.querySelector('#overlays');
                     if (!injectionTarget) injectionTarget = stdThumbnail;
                 }
             }
        }

        // 2. Try Shorts Grid Item (ytm-shorts-lockup-view-model)
        if (!videoId) {
            const shortsModel = item.querySelector('ytm-shorts-lockup-view-model');
            if (shortsModel) {
                const shortsAnchor = shortsModel.querySelector('a[href^="/shorts/"]');
                if (shortsAnchor && shortsAnchor.href) {
                    videoId = extractVideoId(shortsAnchor.href);
                    injectionTarget = shortsModel.querySelector('.shortsLockupViewModelHostThumbnailContainer');
                    if (!injectionTarget) injectionTarget = shortsModel; 
                }
            }
        }
        
        // Check if this is a valid video
        if (!videoId || !injectionTarget) return;
        
        // CRITICAL: Handle DOM recycling by YouTube's virtual scroller
        // Check if the video ID has changed (element was recycled for different video)
        const previousId = item.dataset.ytbVideoId;
        
        if (previousId && previousId !== videoId) {
            // Video ID changed! YouTube recycled this DOM element
            // Remove old checkbox and clear processed flag
            const oldCheckbox = injectionTarget.querySelector('.yt-extractor-checkbox');
            if (oldCheckbox) oldCheckbox.remove();
            delete item.dataset.ytbProcessed;
            delete item.dataset.ytbVideoId;
        }
        
        // Skip if already processed with same video ID
        if (item.dataset.ytbProcessed && item.dataset.ytbVideoId === videoId) {
            return;
        }
        
        // Mark as processed with current video ID
        item.dataset.ytbProcessed = 'true';
        item.dataset.ytbVideoId = videoId;
        
        injectCheckbox(injectionTarget, videoId, item);
        newItemsCount++;
    });

    if (newItemsCount > 0) {
        console.log(`[YTB] Processed ${newItemsCount} items.`);
    }
}

function extractVideoId(url) {
    if (!url) return null;
    try {
        const u = new URL(url, window.location.origin); // safe parse
        if (u.pathname === '/watch') {
            return u.searchParams.get('v');
        }
        if (u.pathname.startsWith('/shorts/')) {
            return u.pathname.split('/shorts/')[1];
        }
    } catch (e) { return null; }
    return null;
}

function injectCheckbox(container, videoId, parentItem) {
    // Sanity check
    if (container.querySelector('.yt-extractor-checkbox')) return;
    
    // Position handling
    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
        container.style.position = 'relative';
    }

    const checkbox = document.createElement('div');
    checkbox.className = 'yt-extractor-checkbox';
    checkbox.title = 'Select to extract';
    
    const svgChecked = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
       <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
    
    if (selectedVideos.has(videoId)) {
        checkbox.classList.add('selected');
        checkbox.innerHTML = svgChecked;
    }

    checkbox.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); 
        toggleSelection(videoId, parentItem, checkbox, svgChecked);
    });

    container.appendChild(checkbox);
}

function toggleSelection(videoId, parentItem, checkbox, svgResult) {
    if (selectedVideos.has(videoId)) {
        selectedVideos.delete(videoId);
        checkbox.classList.remove('selected');
        checkbox.innerHTML = '';
    } else {
        const data = extractMetadata(videoId, parentItem);
        selectedVideos.set(videoId, data);
        checkbox.classList.add('selected');
        checkbox.innerHTML = svgResult;
    }
    
    try {
        chrome.runtime.sendMessage({ action: 'updateCount', count: selectedVideos.size });
    } catch(e) {}
}

function extractMetadata(id, parentItem) {
    let url = `https://www.youtube.com/watch?v=${id}`;
    let title = 'Unknown Video';
    let channelId = '';

    // --- Title Extraction ---
    // 1. Standard
    const titleEl = parentItem.querySelector('#video-title');
    if (titleEl) {
        title = titleEl.textContent.trim();
    } else {
         const titleLink = parentItem.querySelector('a#video-title-link');
         if (titleLink) title = titleLink.title || titleLink.textContent.trim();
    }
    
    // 2. Shorts (Fallback if standard didn't work)
    if ((title === 'Unknown Video' || !title)) {
        // Try the Shorts specific title selector
        const shortTitleEl = parentItem.querySelector('.shortsLockupViewModelHostMetadataTitle span[role="text"]');
        if (shortTitleEl) {
            title = shortTitleEl.textContent.trim();
        }
    }

    // --- Channel ID Extraction ---
    // 1. Standard Channel Link
    let channelLink = parentItem.querySelector('ytd-channel-name a');
    
    // 2. Shorts often don't display channel in grid. 
    //    We might NOT find it. That's okay, return empty as requested ('id, link, channel id, title' - implies if available)
    
    if (channelLink) {
        const href = channelLink.getAttribute('href');
        if (href) {
            // /channel/UC..., /@handle, /user/name
            if (href.includes('/channel/')) {
                channelId = href.split('/channel/')[1];
            } else if (href.includes('/@')) {
                channelId = href.split('/@')[1]; // Return the handle as ID
            } else {
                 // Fallback
                 channelId = href.split('/').pop();
            }
        }
    }

    return { id, url, title, channelId };
}

// --- Messaging ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'toggleExtractor') {
        if (msg.state) enableExtractor();
        else disableExtractor();
    } 
    else if (msg.action === 'getSelected') {
        sendResponse({ count: selectedVideos.size });
    }
    else if (msg.action === 'clearSelection') {
        selectedVideos.clear();
        document.querySelectorAll('.yt-extractor-checkbox.selected').forEach(el => {
            el.classList.remove('selected');
            el.innerHTML = '';
        });
        sendResponse({ success: true });
    }
    else if (msg.action === 'getExportData') {
        const data = Array.from(selectedVideos.values());
        let exportContent = '';
        
        if (msg.format === 'csv') {
            // Add BOM for Excel compatibility
            const bom = '\uFEFF';
            const headers = 'ID,Link,Channel ID,Title\n';
            const rows = data.map(v => {
                // Escape quotes
                const cId = (v.channelId || '').replace(/"/g, '""');
                const title = (v.title || '').replace(/"/g, '""');
                return `${v.id},${v.url},"${cId}","${title}"`;
            }).join('\n');
            exportContent = bom + headers + rows;
        } 
        else if (msg.format === 'json') {
            exportContent = JSON.stringify(data, null, 2);
        }
        else if (msg.format === 'clipboard') {
            // User requested ONLY links
            exportContent = data.map(v => v.url).join('\n');
        }
        else if (msg.format === 'idm') {
            // IDM Export Format (.ef2)
            // Format:
            // <
            // URL
            // >
            exportContent = data.map(v => `<\r\n${v.url}\r\n>`).join('\r\n');
        }
        
        sendResponse({ success: true, data: exportContent });
    }
});

// Init
init();
