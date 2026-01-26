# Tính năng Badge "Downloaded"

## Tổng quan

Extension hiện đã được tích hợp tính năng kiểm tra và hiển thị badge "Downloaded" cho các video đã được tải xuống qua backend API.

## Tính năng

### 1. Tự động kiểm tra trạng thái download

- Khi mở trang YouTube channel/videos, extension sẽ tự động:
  - Thu thập tất cả video URLs hiện có trên trang
  - Gọi API backend để kiểm tra trạng thái download
  - Hiển thị badge "Downloaded" cho các video đã tải

### 2. Badge "Downloaded"

- **Vị trí**: Góc trên bên trái của thumbnail video
- **Màu sắc**: Xanh lá (gradient từ #10b981 đến #059669)
- **Nội dung**: ✓ DOWNLOADED
- **Style**:
  - Font size: 11px
  - Font weight: 600 (semi-bold)
  - Shadow để nổi bật trên thumbnail
  - Uppercase với letter-spacing

### 3. Cập nhật động

- Badge được cập nhật tự động khi:
  - Lần đầu load trang
  - Scroll và load thêm video (infinite scroll)
  - DOM thay đổi (YouTube dynamic content)

## Cách sử dụng

### Yêu cầu

1. **Backend API phải đang chạy**:

   ```bash
   cd backend
   python main.py
   ```

   API sẽ chạy tại `http://localhost:8000`

2. **Extension đã được build**:

   ```bash
   npm run build
   ```

3. **Extension đã được load vào Chrome**:
   - Mở `chrome://extensions/`
   - Bật "Developer mode"
   - Click "Load unpacked"
   - Chọn thư mục extension

### Sử dụng

1. Mở trang YouTube channel hoặc video list
2. Bật extension (toggle switch trong popup)
3. Extension sẽ:
   - Hiển thị checkbox để select video
   - Tự động kiểm tra và hiển thị badge "Downloaded" cho video đã tải
4. Badge "Downloaded" xuất hiện ở góc trên bên trái thumbnail

## API Backend

Extension sử dụng endpoint:

```
POST http://127.0.0.1:8000/api/downloads/check_downloads
```

**Request:**

```json
{
  "urls": [
    "https://www.youtube.com/watch?v=VIDEO_ID_1",
    "https://www.youtube.com/watch?v=VIDEO_ID_2"
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "url": "https://www.youtube.com/watch?v=VIDEO_ID_1",
      "video_id": "VIDEO_ID_1",
      "is_downloaded": true,
      "download_date": "2026-01-24T10:30:00",
      "file_path": "./downloads/Channel/Video Title.mp4",
      "video_title": "Video Title",
      "error": null
    }
  ],
  "total_checked": 2,
  "total_downloaded": 1
}
```

## Cấu trúc Code

### Files đã thay đổi

1. **src/types.ts**
   - Thêm `API_BASE_URL`
   - Thêm `isDownloaded`, `downloadDate`, `filePath` vào `VideoData`
   - Thêm interfaces: `VideoDownloadStatus`, `CheckDownloadsResponse`

2. **src/content.ts**
   - Thêm `downloadedVideosCache` để cache kết quả
   - Thêm `checkDownloadedVideos()`: Gọi API check downloads
   - Thêm `updateDownloadBadges()`: Cập nhật badge cho tất cả video
   - Thêm `addDownloadedBadge()`: Thêm badge vào DOM
   - Tích hợp vào `enableExtractor()` và `processPage()`

3. **styles.css**
   - Thêm `.ytb-downloaded-badge` với style đẹp mắt
   - Gradient xanh lá, shadow, uppercase

## Kỹ thuật

### Caching

- Extension cache kết quả check download trong `downloadedVideosCache`
- Tránh gọi API nhiều lần cho cùng video
- Cache được update mỗi khi `updateDownloadBadges()` được gọi

### Performance

- Batch checking: Gửi nhiều URLs trong 1 request
- Debounce: Chờ 500ms sau khi DOM thay đổi trước khi process
- Async: Không block UI khi gọi API

### Error Handling

- Try-catch cho API calls
- Nếu API fail, extension vẫn hoạt động bình thường (chỉ không hiển thị badge)
- Console.error để debug

## Cấu hình

### Thay đổi API URL

Nếu backend chạy ở địa chỉ khác, sửa trong [src/content.ts](src/content.ts#L17):

```typescript
const API_URL = "http://localhost:8000";
```

### Thay đổi style badge

Sửa trong [styles.css](styles.css):

```css
.ytb-downloaded-badge {
  /* Tùy chỉnh màu, size, position... */
}
```

## Testing

### Manual Test

1. Đảm bảo có video đã download trong database
2. Mở YouTube channel có video đó
3. Bật extension
4. Kiểm tra badge "Downloaded" xuất hiện

### Console Logs

Extension log thông tin hữu ích:

```
[YTB Extractor] ENABLED
[YTB] Processed 20 items.
[YTB] Downloaded check: 5/20 videos
```

## Troubleshooting

### Badge không hiển thị

1. **Kiểm tra backend API**:

   ```bash
   curl http://127.0.0.1:8000/api/downloads/check_downloads -X POST -H "Content-Type: application/json" -d '{"urls":["https://www.youtube.com/watch?v=dQw4w9WgXcQ"]}'
   ```

2. **Kiểm tra Console**:
   - Mở DevTools (F12)
   - Tab Console
   - Tìm lỗi `[YTB]`

3. **Kiểm tra CORS**:
   - Đảm bảo backend cho phép CORS từ extension

### API chậm

- Backend có thể chậm khi check nhiều video
- Có thể tăng timeout trong `updateDownloadBadges()`

## Future Improvements

- [ ] Thêm option để bật/tắt download check
- [ ] Cho phép config API URL trong popup
- [ ] Hiển thị thêm thông tin (download date, file path) khi hover badge
- [ ] Cache lâu hơn (LocalStorage) để giảm API calls
- [ ] Retry logic khi API fail
- [ ] Loading indicator khi đang check

## Screenshots

### Badge trên video grid

```
┌──────────────────────┐
│ ✓ DOWNLOADED         │ ← Badge
│                      │
│   [Video Thumbnail]  │
│                      │
│   Video Title        │ ☑ ← Checkbox
└──────────────────────┘
```

### Badge style

- Màu xanh lá nổi bật
- Dễ nhận biết video đã tải
- Không che khuất nội dung quan trọng
