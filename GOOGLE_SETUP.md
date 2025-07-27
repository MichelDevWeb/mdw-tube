# Hướng dẫn Setup Google Cloud Console cho MDW Tube

## Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập bằng tài khoản Google của bạn
3. Click "Select a project" → "New Project"
4. Đặt tên project: `MDW Tube Extension`
5. Click "Create"

## Bước 2: Enable YouTube Data API v3

1. Trong project vừa tạo, vào **APIs & Services** → **Library**
2. Tìm kiếm "YouTube Data API v3"
3. Click vào result đầu tiên
4. Click **Enable**

## Bước 3: Tạo API Key

1. Vào **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **API Key**
3. Copy API Key được tạo ra
4. Click **Restrict Key** để cấu hình:
   - **Application restrictions**: None
   - **API restrictions**: Select "YouTube Data API v3"
5. Click **Save**

## Bước 4: Tạo OAuth 2.0 Client ID

1. Trong **Credentials**, click **+ Create Credentials** → **OAuth client ID**
2. Nếu chưa có OAuth consent screen, sẽ được yêu cầu tạo:
   - **User Type**: External
   - **App name**: MDW Tube
   - **User support email**: email của bạn
   - **Developer contact**: email của bạn
   - Click **Save and Continue** qua các bước còn lại
3. Tạo OAuth client ID:
   - **Application type**: Chrome Extension
   - **Name**: MDW Tube Extension
   - **Application ID**: `kkjhalhacihdmgojhdlpiocagjmflnbn` (Extension ID từ manifest key)
4. Click **Create**
5. Copy **Client ID** được tạo ra

## Bước 5: Cấu hình Extension

Cập nhật file `config.js`:

```javascript
const CONFIG = {
    YOUTUBE_API_KEY: 'YOUR_API_KEY_FROM_STEP_3',
    GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_FROM_STEP_4',
    // ... rest of config
};
```

## Bước 6: Test Extension

1. Load extension trong Chrome (`chrome://extensions/`)
2. Click vào icon extension
3. Tab **Channels** → Click **Đăng nhập YouTube**
4. Sẽ mở popup Google OAuth, đăng nhập và cho phép quyền
5. Sau khi đăng nhập thành công, click **Đồng bộ channels (API)**
6. Kiểm tra tab **Xem sau** có hiển thị videos

## Troubleshooting

### Lỗi "Authorization page could not be loaded"

**Nguyên nhân**: Client ID không đúng hoặc Extension ID không match

**Giải pháp**:
1. Kiểm tra Client ID trong `config.js` có đúng không
2. Kiểm tra Extension ID trong Google Cloud Console có đúng `kkjhalhacihdmgojhdlpiocagjmflnbn` không
3. Xóa và tạo lại OAuth Client ID nếu cần

### Lỗi "Access blocked: This app's request is invalid"

**Nguyên nhân**: OAuth consent screen chưa được setup đúng

**Giải pháp**:
1. Vào **OAuth consent screen** trong Google Cloud Console
2. Đảm bảo **Publishing status** là "In production" hoặc thêm email test vào **Test users**

### Quota exceeded

**Nguyên nhân**: Vượt quá giới hạn API calls

**Giải pháp**:
1. Vào **APIs & Services** → **Quotas**
2. Kiểm tra usage của YouTube Data API v3
3. Tối ưu số lượng API calls hoặc request quota tăng

## Notes

- Extension ID được tạo từ `key` trong `manifest.json`
- Redirect URI sẽ tự động là: `https://kkjhalhacihdmgojhdlpiocagjmflnbn.chromiumapp.org/`
- API Key có thể bị rate limit, nên sử dụng cẩn thận
- OAuth token có thời hạn 1 giờ, extension sẽ tự động refresh khi cần 