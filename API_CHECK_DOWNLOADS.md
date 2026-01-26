# API Kiểm Tra Video Đã Tải Xuống

## Endpoint

```
POST /api/downloads/check_downloads
```

## Mô tả

API này kiểm tra xem các video YouTube đã được tải xuống thành công hay chưa. Endpoint nhận vào một mảng các URL video và trả về trạng thái tải xuống của từng video.

## Request

### Headers

```
Content-Type: application/json
```

### Body Schema

```json
{
  "urls": ["string"]
}
```

**Trường:**

- `urls` (array, required): Mảng các URL video YouTube cần kiểm tra

**Định dạng URL được hỗ trợ:**

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`

### Ví dụ Request

```json
{
  "urls": [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/jNQXAC9IVRw",
    "https://www.youtube.com/watch?v=9bZkp7q19f0"
  ]
}
```

## Response

### Success Response (200 OK)

```json
{
  "results": [
    {
      "url": "string",
      "video_id": "string",
      "is_downloaded": true,
      "download_date": "2026-01-24T10:30:00",
      "file_path": "string",
      "video_title": "string",
      "error": null
    }
  ],
  "total_checked": 0,
  "total_downloaded": 0
}
```

**Trường response:**

- `results` (array): Mảng kết quả cho từng URL
  - `url` (string): URL video đã kiểm tra
  - `video_id` (string|null): ID video YouTube (null nếu URL không hợp lệ)
  - `is_downloaded` (boolean): `true` nếu video đã được tải xuống thành công
  - `download_date` (datetime|null): Ngày giờ tải xuống (null nếu chưa tải)
  - `file_path` (string|null): Đường dẫn file video (null nếu chưa tải)
  - `video_title` (string|null): Tiêu đề video (null nếu chưa tải)
  - `error` (string|null): Thông báo lỗi nếu có
- `total_checked` (integer): Tổng số URL đã kiểm tra
- `total_downloaded` (integer): Tổng số video đã được tải xuống

### Ví dụ Response

#### Video đã tải xuống

```json
{
  "results": [
    {
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "video_id": "dQw4w9WgXcQ",
      "is_downloaded": true,
      "download_date": "2026-01-24T08:15:30",
      "file_path": "./downloads/Test Channel/Rick Astley - Never Gonna Give You Up.mp4",
      "video_title": "Rick Astley - Never Gonna Give You Up",
      "error": null
    },
    {
      "url": "https://youtu.be/jNQXAC9IVRw",
      "video_id": "jNQXAC9IVRw",
      "is_downloaded": false,
      "download_date": null,
      "file_path": null,
      "video_title": null,
      "error": null
    }
  ],
  "total_checked": 2,
  "total_downloaded": 1
}
```

#### URL không hợp lệ

```json
{
  "results": [
    {
      "url": "https://invalid-url.com",
      "video_id": null,
      "is_downloaded": false,
      "download_date": null,
      "file_path": null,
      "video_title": null,
      "error": "Invalid YouTube URL"
    }
  ],
  "total_checked": 1,
  "total_downloaded": 0
}
```

### Error Responses

#### 400 Bad Request - Mảng rỗng

```json
{
  "detail": "urls list cannot be empty"
}
```

#### 500 Internal Server Error

```json
{
  "detail": "Failed to check downloads: <error message>"
}
```

## Cách sử dụng

### Python Example

```python
import requests

url = "http://127.0.0.1:8000/api/downloads/check_downloads"

payload = {
    "urls": [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/jNQXAC9IVRw"
    ]
}

response = requests.post(url, json=payload)
data = response.json()

print(f"Đã kiểm tra: {data['total_checked']} videos")
print(f"Đã tải xuống: {data['total_downloaded']} videos")

for result in data['results']:
    if result['is_downloaded']:
        print(f"✓ {result['video_title']}")
    else:
        print(f"✗ {result['url']} - Chưa tải xuống")
```

### JavaScript/Fetch Example

```javascript
const checkDownloads = async (urls) => {
  const response = await fetch(
    "http://127.0.0.1:8000/api/downloads/check_downloads",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls }),
    },
  );

  const data = await response.json();

  console.log(`Checked: ${data.total_checked}`);
  console.log(`Downloaded: ${data.total_downloaded}`);

  data.results.forEach((result) => {
    if (result.is_downloaded) {
      console.log(`✓ ${result.video_title}`);
    } else {
      console.log(`✗ ${result.url} - Not downloaded`);
    }
  });
};

// Sử dụng
checkDownloads([
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/jNQXAC9IVRw",
]);
```

### cURL Example

```bash
curl -X POST "http://127.0.0.1:8000/api/downloads/check_downloads" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/jNQXAC9IVRw"
    ]
  }'
```

## Use Cases

1. **Kiểm tra trước khi tải xuống**: Tránh tải lại video đã có
2. **Đồng bộ playlist**: Xác định video nào còn thiếu trong playlist
3. **Báo cáo tải xuống**: Tạo báo cáo về các video đã tải
4. **Batch processing**: Xử lý hàng loạt URL và lọc ra video chưa tải

## Lưu ý

- API chỉ kiểm tra các video đã được tải xuống **thành công** (`success=true` trong database)
- Nếu một video có nhiều lần tải xuống, API trả về bản ghi mới nhất
- URL không hợp lệ sẽ trả về `error: "Invalid YouTube URL"`
- API hỗ trợ kiểm tra nhiều URL trong một request
