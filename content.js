
// State
let selectedVideos = new Map(); // ID -> VideoData

// Configuration
const SELECTORS = {
    // Containers
    videoRenderer: 'ytd-video-renderer', // Search results
    richItemRenderer: 'ytd-rich-item-renderer', // Home feed
    gridVideoRenderer: 'ytd-grid-video-renderer', // Channel videos
    reelItemRenderer: 'ytd-reel-item-renderer', // Shorts (sometimes)
    compactVideoRenderer: 'ytd-compact-video-renderer', // Sidebar

    // Elements inside container
    thumbnail: 'a#thumbnail',
    title: '#video-title',
    channelName: '#channel-info #text', // or .ytd-channel-name
    metadataLine: '#metadata-line', 
    overlays: '#overlays', // Video length usually here
};

// Utils
function generateCSV(videos) {
    const headers = ['ID', 'Title', 'URL', 'Channel', 'ChannelID', 'Duration', 'Views'];
    const rows = videos.map(v => [
        `"${v.id}"`,
        `"${v.title.replace(/"/g, '""')}"`,
        `"${v.url}"`,
        `"${v.channel.replace(/"/g, '""')}"`,
        `"${v.channelId || ''}"`,
        `"${v.duration}"`,
        `"${v.views}"`
    ]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function generateJSON(videos) {
    return JSON.stringify(videos, null, 2);
}

// Logic
function init() {
    console.log('YouTube Link Extractor: Initializing...');
    
    // Observer for dynamic content
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        for (const m of mutations) {
            if (m.addedNodes.length) {
                shouldProcess = true;
                break;
            }
        }
        if (shouldProcess) processVideos();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial process
    setTimeout(processVideos, 1000); // Give a bit of time for initial load
}

function processVideos() {
    // Find all potential video containers
    // We target the thumbnail container specifically to inject our checkbox
    const thumbnails = document.querySelectorAll('ytd-thumbnail, a#thumbnail');

    thumbnails.forEach(thumb => {
        // Avoid re-injection
        if (thumb.dataset.ytbExtractorInjected) return;
        
        // Find parent that holds metadata (approximation)
        // We usually want to find the clickable anchor to get the ID/URL
        const anchor = thumb.tagName === 'A' ? thumb : thumb.querySelector('a#thumbnail');
        if (!anchor || !anchor.href) return;
        
        // Check if it's a video (has watch?v=) or Short (shorts/)
        const href = anchor.href;
        let videoId = null;
        let type = 'video';
        
        if (href.includes('watch?v=')) {
            videoId = new URL(href).searchParams.get('v');
        } else if (href.includes('/shorts/')) {
            videoId = href.split('/shorts/')[1];
            type = 'short';
        }

        if (!videoId) return;

        // Mark as processed
        thumb.dataset.ytbExtractorInjected = 'true';
        thumb.style.position = 'relative';

        // Create Checkbox
        const checkbox = document.createElement('div');
        checkbox.className = 'yt-extractor-checkbox';
        checkbox.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            z-index: 9999;
            width: 24px;
            height: 24px;
            background: rgba(0,0,0,0.6);
            border: 2px solid #fff;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        `;
        
        // Check if already selected (persistence logic if we want, for now reset on reload)
        if (selectedVideos.has(videoId)) {
            checkbox.classList.add('selected');
            checkbox.style.background = '#3ea6ff';
            checkbox.innerHTML = '✓';
        }

        checkbox.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSelection(videoId, checkbox, thumb);
        };

        // Inject
        // If it's ytd-thumbnail, append to it.
        // If it's 'a' tag, ensure it has block display or position relative
        thumb.appendChild(checkbox);
    });
}

function toggleSelection(id, checkbox, container) {
    if (selectedVideos.has(id)) {
        selectedVideos.delete(id);
        checkbox.style.background = 'rgba(0,0,0,0.6)';
        checkbox.innerHTML = '';
    } else {
        const data = extractData(id, container);
        if (data) {
            selectedVideos.set(id, data);
            checkbox.style.background = '#3ea6ff';
            checkbox.style.color = 'white';
            checkbox.style.fontWeight = 'bold';
            checkbox.innerHTML = '✓';
        } else {
            console.warn('Could not extract data for', id);
        }
    }
    notifyUpdate();
}

function extractData(id, container) {
    try {
        // We need to traverse up from the thumbnail to find the main container (renderer)
        // Then query down for title, etc.
        const renderer = container.closest('ytd-video-renderer, ytd-grid-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer');
        
        if (!renderer) {
            // Fallback for simple extraction if we can't find specific renderer
             const anchor = container.querySelector('a#thumbnail') || (container.tagName === 'A' ? container : null);
             return {
                 id: id,
                 url: anchor ? anchor.href : `https://www.youtube.com/watch?v=${id}`,
                 title: 'Unknown Title',
                 channel: 'Unknown',
                 duration: '',
                 views: ''
             };
        }

        // Title
        let title = '';
        const titleEl = renderer.querySelector('#video-title');
        if (titleEl) {
             title = titleEl.textContent.trim();
             // Sometimes title is in attribute 'title'
             if (!title && titleEl.getAttribute('title')) title = titleEl.getAttribute('title');
        }

        // Channel
        let channel = '';
        let channelId = '';
        const channelEl = renderer.querySelector('#channel-info #text, .ytd-channel-name a, #text.ytd-channel-name');
        if (channelEl) {
            channel = channelEl.textContent.trim();
            // Try to get href for ID/Handle
            const channelLink = channelEl.closest('a');
            if (channelLink) {
                 const href = channelLink.href;
                 if (href.includes('/channel/')) channelId = href.split('/channel/')[1].split('/')[0];
                 else if (href.includes('/@')) channelId = '@' + href.split('/@')[1].split('/')[0];
                 else channelId = href; // Fallback to full URL
            }
        }

        // Metadata (Views, Time)
        // Usually in #metadata-line. It contains spans.
        // Format: "2M views", "3 months ago"
        let views = '';
        const metadataSpans = renderer.querySelectorAll('#metadata-line span');
        if (metadataSpans && metadataSpans.length > 0) {
            // First one is usually views (or "Waiting" or "Scheduled")
            // Iterate to find the one with "views"
            metadataSpans.forEach(span => {
                if (span.textContent.includes('views') || span.textContent.includes('lượt xem')) {
                    views = span.textContent.trim();
                }
            });
        }
        
        // Duration
        // Usually in ytd-thumbnail-overlay-time-status-renderer
        let duration = '';
        const timeEl = renderer.querySelector('ytd-thumbnail-overlay-time-status-renderer, span.ytd-thumbnail-overlay-time-status-renderer');
        if (timeEl) duration = timeEl.textContent.trim();


        // Clean URL
        const url = `https://www.youtube.com/watch?v=${id}`;

        return { id, title, url, channel, channelId, duration, views };

    } catch (e) {
        console.error('Error extracting data:', e);
        return null;
    }
}

function notifyUpdate() {
    chrome.runtime.sendMessage({
        action: 'updateCount',
        count: selectedVideos.size
    }).catch(() => {
        // Popup might be closed, ignore
    });
}

// Message Listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'getStatus') {
        sendResponse({ count: selectedVideos.size });
    } else if (msg.action === 'clearSelection') {
        selectedVideos.clear();
        // Update UI
        document.querySelectorAll('.yt-extractor-checkbox').forEach(cb => {
            cb.style.background = 'rgba(0,0,0,0.6)';
            cb.innerHTML = '';
        });
        sendResponse({ success: true });
    } else if (msg.action === 'export') {
        if (selectedVideos.size === 0) {
            sendResponse({ success: false, message: 'No videos selected' });
            return;
        }

        const videos = Array.from(selectedVideos.values());
        
        try {
            if (msg.type === 'copy') {
                // Return string to popup to copy
                // Format: Title - URL
                const text = videos.map(v => `${v.title}\n${v.url}`).join('\n\n');
                sendResponse({ success: true, data: text });
            } else if (msg.type === 'csv') {
                const csv = generateCSV(videos);
                sendResponse({ 
                    success: true, 
                    data: csv, 
                    filename: `youtube_export_${new Date().toISOString().slice(0,10)}.csv`,
                    mimeType: 'text/csv'
                });
            } else if (msg.type === 'json') {
                const json = generateJSON(videos);
                sendResponse({ 
                    success: true, 
                    data: json, 
                    filename: `youtube_export_${new Date().toISOString().slice(0,10)}.json`,
                    mimeType: 'application/json'
                });
            }
        } catch(err) {
            console.error(err);
            sendResponse({ success: false, message: 'Export failed' });
        }
    }
    return true; // Keep channel open
});

// Run
init();
