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
    
    // Remove click blockers from all items
    document.querySelectorAll('[data-ytb-processed]').forEach(item => {
        if (item._ytbClickBlocker) {
            item.removeEventListener('click', item._ytbClickBlocker, true);
            delete item._ytbClickBlocker;
        }
        delete item.dataset.ytbProcessed;
        delete item.dataset.ytbVideoId;
    });
    
    // Remove all checkboxes
    const checkboxes = document.querySelectorAll('.yt-extractor-checkbox');
    checkboxes.forEach(el => el.remove());
    
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
        'ytd-rich-grid-media',      // Standard grid videos (nested in rich-item-renderer)
        'ytd-video-renderer',        // Search results, subscriptions feed
        'ytd-grid-video-renderer',   // Channel videos grid
        'ytd-compact-video-renderer', // Sidebar recommendations
        'ytd-reel-item-renderer'     // Shorts in feed
    ];
    
    const items = document.querySelectorAll(itemSelectors.join(','));
    let newItemsCount = 0;

    items.forEach(item => {
        let videoId = null;
        let injectionTarget = null;
        let isShorts = false;
        
        // 1. Try Standard Video (ytd-thumbnail)
        const stdThumbnail = item.querySelector('ytd-thumbnail, ytd-playlist-thumbnail');
        if (stdThumbnail) {
             const anchor = stdThumbnail.querySelector('a#thumbnail');
             if (anchor && anchor.href) {
                 const extractedId = extractVideoId(anchor.href);
                 if (extractedId) {
                     videoId = extractedId;
                     
                     // For standard videos: inject into details area, not thumbnail
                     // This makes it more visible and doesn't obscure the video preview
                     const detailsArea = item.querySelector('#details');
                     if (detailsArea) {
                         // Try to find or create a checkbox container in details
                         let checkboxContainer = detailsArea.querySelector('.ytb-checkbox-container');
                         if (!checkboxContainer) {
                             checkboxContainer = document.createElement('div');
                             checkboxContainer.className = 'ytb-checkbox-container';
                             checkboxContainer.style.cssText = 'position: absolute; top: 8px; right: 8px; z-index: 100;';
                             detailsArea.style.position = 'relative'; // Ensure positioning context
                             detailsArea.appendChild(checkboxContainer);
                         }
                         injectionTarget = checkboxContainer;
                     } else {
                         // Fallback to thumbnail overlays if details not found
                         injectionTarget = stdThumbnail.querySelector('#overlays') || stdThumbnail;
                     }
                 }
             }
        }

        // 2. Try Shorts Grid Item (ytm-shorts-lockup-view-model)
        if (!videoId) {
            const shortsModel = item.querySelector('ytm-shorts-lockup-view-model');
            if (shortsModel) {
                isShorts = true;
                const shortsAnchor = shortsModel.querySelector('a[href^="/shorts/"]');
                if (shortsAnchor && shortsAnchor.href) {
                    videoId = extractVideoId(shortsAnchor.href);
                    // For Shorts: keep thumbnail injection
                    injectionTarget = shortsModel.querySelector('.shortsLockupViewModelHostThumbnailContainer');
                    if (!injectionTarget) injectionTarget = shortsModel; 
                }
            }
        }
        
        // Check if this is a valid video
        if (!videoId || !injectionTarget) return;
        
        // CRITICAL: Handle DOM recycling by YouTube's virtual scroller
        const previousId = item.dataset.ytbVideoId;
        
        if (previousId && previousId !== videoId) {
            // Video ID changed - element was recycled
            const oldCheckbox = injectionTarget.querySelector('.yt-extractor-checkbox');
            if (oldCheckbox) oldCheckbox.remove();
            delete item.dataset.ytbProcessed;
            delete item.dataset.ytbVideoId;
            // Remove old click blocker if exists
            if (item._ytbClickBlocker) {
                item.removeEventListener('click', item._ytbClickBlocker, true);
                delete item._ytbClickBlocker;
            }
        }
        
        // Skip if already processed with same video ID
        if (item.dataset.ytbProcessed && item.dataset.ytbVideoId === videoId) {
            return;
        }
        
        // Mark as processed with current video ID
        item.dataset.ytbProcessed = 'true';
        item.dataset.ytbVideoId = videoId;
        
        // Add click blocker to prevent navigation and handle selection
        if (!item._ytbClickBlocker) {
            item._ytbClickBlocker = function(e) {
                // Block navigation
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Find the checkbox in this item
                const checkbox = item.querySelector('.yt-extractor-checkbox');
                if (checkbox) {
                    // Toggle selection by programmatically triggering checkbox logic
                    const videoId = item.dataset.ytbVideoId;
                    if (videoId) {
                        toggleSelection(videoId, item, checkbox, `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
       <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`);
                    }
                }
                
                return false;
            };
            
            // Use capture phase to intercept before YouTube's handlers
            item.addEventListener('click', item._ytbClickBlocker, true);
        }
        
        injectCheckbox(injectionTarget, videoId, item, isShorts);
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

function injectCheckbox(container, videoId, parentItem, isShorts = false) {
    // Sanity check
    if (container.querySelector('.yt-extractor-checkbox')) return;
    
    // Position handling - only needed for Shorts thumbnails
    if (isShorts) {
        const style = window.getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }
    }

    const checkbox = document.createElement('div');
    checkbox.className = 'yt-extractor-checkbox';
    checkbox.title = 'Click anywhere to select';
    checkbox.dataset.vid = videoId;
    
    const svgChecked = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
       <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
    
    if (selectedVideos.has(videoId)) {
        checkbox.classList.add('selected');
        checkbox.innerHTML = svgChecked;
    }

    // No click listener needed - handled by item's click blocker

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
    
    notifySelectionChange();
}

function notifySelectionChange() {
    try {
        chrome.runtime.sendMessage({ 
            action: 'selectionChanged', 
            count: selectedVideos.size,
            items: Array.from(selectedVideos.values())
        });
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
        sendResponse({ 
            count: selectedVideos.size,
            items: Array.from(selectedVideos.values())
        });
    }
    else if (msg.action === 'removeVideo') {
        const videoId = msg.videoId;
        if (videoId && selectedVideos.has(videoId)) {
            selectedVideos.delete(videoId);
            
            // Find and update checkbox in DOM
            const checkbox = document.querySelector(`.yt-extractor-checkbox[data-vid="${videoId}"]`);
            if (checkbox) {
                checkbox.classList.remove('selected');
                checkbox.innerHTML = '';
            }
            
            notifySelectionChange();
        }
    }
    else if (msg.action === 'clearSelection') {
        selectedVideos.clear();
        document.querySelectorAll('.yt-extractor-checkbox.selected').forEach(el => {
            el.classList.remove('selected');
            el.innerHTML = '';
        });
        notifySelectionChange();
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
