// Type definitions for YouTube Link Extractor extension

// API Configuration
export const API_BASE_URL = "http://localhost:8000";

export interface VideoData {
  id: string;
  url: string;
  title: string;
  channelId: string;
  isDownloaded?: boolean;
  downloadDate?: string;
  filePath?: string;
}

export interface StorageData {
  ytbExtractorEnabled?: boolean;
}

export interface Message {
  action: string;
  state?: boolean;
  videoId?: string;
  format?: "csv" | "json" | "clipboard" | "idm";
  count?: number;
  items?: VideoData[];
}

export interface ExportResponse {
  success: boolean;
  data?: string;
}

export interface SelectionResponse {
  count: number;
  items: VideoData[];
}

export interface ExtendedHTMLElement extends HTMLElement {
  _ytbClickBlocker?: (e: Event) => boolean;
}

// API Response Types
export interface VideoDownloadStatus {
  url: string;
  video_id: string | null;
  is_downloaded: boolean;
  download_date: string | null;
  file_path: string | null;
  video_title: string | null;
  error: string | null;
}

export interface CheckDownloadsResponse {
  results: VideoDownloadStatus[];
  total_checked: number;
  total_downloaded: number;
}
