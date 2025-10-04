# Công cụ đóng dấu ảnh (Watermark Tool)

Ứng dụng desktop đơn giản để thêm watermark văn bản lên hàng loạt ảnh.

## ✨ Tính năng

- ✅ Xử lý hàng loạt nhiều ảnh cùng lúc
- ✅ Tùy chỉnh nội dung, cỡ chữ, màu sắc watermark
- ✅ Điều chỉnh góc xoay, khoảng cách, độ mờ, mật độ
- ✅ Xem trước kết quả ngay trên giao diện
- ✅ Hỗ trợ nhiều định dạng ảnh: JPG, PNG, BMP, GIF, TIFF, WEBP

## 🚀 Cách sử dụng

1. **Chọn thư mục ảnh gốc**: Thư mục chứa các ảnh cần đóng watermark
2. **Chọn thư mục lưu kết quả**: Thư mục để lưu ảnh đã xử lý
3. **Nhập nội dung watermark**: Văn bản muốn đóng lên ảnh
4. **Tùy chỉnh**: Điều chỉnh các thông số như cỡ chữ, màu sắc, góc xoay...
5. **Xem trước**: Chọn ảnh để xem trước kết quả
6. **Bắt đầu**: Nhấn nút "BẮT ĐẦU" để xử lý

## 💻 Cài đặt & Chạy (Dành cho Developer)

### Yêu cầu
- Node.js 14+ 
- npm

### Cài đặt dependencies
```bash
npm install
```

### Chạy ứng dụng
```bash
npm start
```

### Build file exe
```bash
npm run build
```

File exe sẽ được tạo trong thư mục `dist/`

## 📦 Sử dụng file Portable

1. Tải file **WatermarkTool-Portable.exe**
2. Chạy trực tiếp - không cần cài đặt
3. Không cần Node.js trên máy

## 📝 Lưu ý

- Thư mục ảnh gốc và thư mục lưu kết quả phải khác nhau
- Ảnh đầu ra sẽ được resize về kích thước cạnh ngắn nhất = 2048px

## 🛠️ Công nghệ sử dụng

- Electron
- Sharp (xử lý ảnh)
- HTML/CSS/JavaScript