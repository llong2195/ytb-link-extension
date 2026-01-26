/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
const API_URL = "http://127.0.0.1:8000";
chrome.runtime.onInstalled.addListener(() => {
    console.log("YouTube Link Extractor installed.");
});
// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkDownloads") {
        checkDownloadedVideos(message.videoUrls)
            .then(sendResponse)
            .catch(error => {
            console.error("[YTB Background] Error checking downloads:", error);
            sendResponse({ error: error.message });
        });
        return true; // Keep channel open for async response
    }
});
/**
 * Check if videos are downloaded by calling the backend API
 */
async function checkDownloadedVideos(videoUrls) {
    if (videoUrls.length === 0)
        return new Map();
    try {
        const response = await fetch(`${API_URL}/api/downloads/check_downloads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ urls: videoUrls }),
        });
        if (!response.ok) {
            console.error("[YTB Background] API check failed:", response.status);
            return new Map();
        }
        const data = await response.json();
        const downloadedMap = new Map();
        data.results.forEach((result) => {
            if (result.video_id) {
                downloadedMap.set(result.video_id, result.is_downloaded);
            }
        });
        console.log(`[YTB Background] Downloaded check: ${data.total_downloaded}/${data.total_checked} videos`);
        // Convert Map to plain object for message passing
        return Object.fromEntries(downloadedMap);
    }
    catch (error) {
        console.error("[YTB Background] Error checking downloads:", error);
        throw error;
    }
}


/******/ })()
;