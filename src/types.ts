// Type definitions for YouTube Link Extractor extension

export interface VideoData {
  id: string;
  url: string;
  title: string;
  channelId: string;
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
