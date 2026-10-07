# Đối chiếu code FreshLink với PDF bản chốt

Ngày kiểm tra: 07/10/2026.

Nguồn yêu cầu: `C:/Users/Admin/Downloads/FRESHLINK - PDF.pdf`, 51 trang. Số trang bên dưới là **thứ tự trang trong file PDF**; số in trên trang nội dung thường nhỏ hơn 4.

Phạm vi kiểm tra: mã nguồn React, Spring Boot, SQL migrations, giao tiếp frontend/backend và các bài kiểm thử có sẵn. Đã trích xuất nội dung PDF và xem ảnh các trang nghiệp vụ, lộ trình, biểu phí, logistics ngược. Không sửa mã nguồn nghiệp vụ, không thay đổi PDF, không triển khai lên website.

## Kết luận

Code có nền tảng cho phần lớn quy trình B2B: bốn nhóm người dùng, đặt hàng, kế hoạch tuần, khai báo cung ứng, phân nguồn, kiểm lô, ghép chuyến, giao nhận, QR, khiếu nại, đối soát và thùng luân chuyển. Tuy nhiên, **chưa thể nói code khớp hoàn toàn với bản PDF chốt**.

Có ba loại khác biệt:

1. Quy tắc nghiệp vụ lệch: giờ chốt 17h thay vì 22h; phí phần trăm thay vì phí/kg ở chương doanh thu; chưa tính phí/thùng.
2. Có một phần hoặc chưa có: thỏa thuận tháng, khoảng giá, dự báo nhu cầu, dự phòng nguồn tự động, AI ngoại quan, OCR chứng chỉ, hàng dư, SLA và báo cáo Xanh theo tháng.
3. Nội dung mở rộng hoặc dữ liệu minh họa: hub toàn quốc, xe/nhiệt độ mẫu, chatbot và OCR ghi chú đặt hàng. Một số dữ liệu mẫu đang đi vào màn hình dùng cho hồ sơ thật, cần ưu tiên sửa.

Không quy đổi thành phần trăm hoàn thành vì PDF là đề án kinh doanh có nhiều giai đoạn, không phải đặc tả nghiệm thu có trọng số.

## 1. Cần hiểu đúng phạm vi MVP

PDF trang 27-30 chia thành:

- Giai đoạn 1, 09/2026-03/2027: prototype web, bốn giao diện, đơn ngày, cung ứng, QR, ghép tuyến, mô phỏng AI ngoại quan, tài xế giao và thu thùng.
- Giai đoạn 2, từ 04/2027: chính thức hóa kế hoạch tuần/thỏa thuận tháng, thu phí, Supplier Passport, Gate, đối soát và AI hỗ trợ quyết định.
- Giai đoạn 3, từ quý II/2028: mở rộng cụm địa bàn, POS/kho, dự báo và tuyến nâng cao, thu gom tái chế.

Do đó, thiếu POS, subscription hoặc AI dự báo hoàn chỉnh không đồng nghĩa MVP hiện tại không đạt. Nhưng giờ chốt, hiển thị QR đúng dữ liệu, chức năng giao/nhận và demo AI Gate là những điểm cần khớp ngay khi trình diễn giai đoạn 1.

## 2. Ma trận chức năng

“Có” nghĩa là tìm thấy mã xử lý và giao diện liên quan, không phải đã nghiệm thu vận hành thực tế.

| Chức năng theo PDF | Trang PDF | Tình trạng trong code | Đánh giá |
|---|---:|---|---|
| Bốn giao diện Nhà hàng, HTX, Admin/điều phối, Tài xế | 8, 27 | Có Portal và phân quyền; vai trò nội bộ tách thêm QC, CSKH, kế toán, tài sản | Có, cách tách vai trò hợp lý |
| Danh mục, đặt đơn ngày, mẫu đơn/đặt lại | 15, 24, 27 | Có catalog, đơn, giỏ và mẫu đơn đã lưu | Có |
| Kế hoạch nhu cầu 7 ngày, chuyển thành đơn ngày | 17, 28 | Có kế hoạch theo tuần Thứ Hai-Chủ nhật, nút chuẩn bị đơn ngày | Có nền tảng; không phải dự báo AI |
| Khóa sửa/đặt đơn lúc 22h T-1 | 15, 17 | Kiểm tra thời hạn tại backend, mặc định 17:00 | Lệch quy tắc |
| Thỏa thuận khung tháng và giá trần | 17, 20, 28 | Có bảng giá SKU theo thời gian; chưa thấy hợp đồng tháng/giá trần riêng từng nhà hàng | Thiếu |
| Khoảng giá dự kiến tổng hợp từ nhiều HTX | 18-19 | Catalog lấy một `selling_unit_price`; UI hiển thị một giá | Thiếu |
| HTX khai báo năng lực, nhận yêu cầu, xác nhận lượng | 15, 27 | Có offers, supply requests và phản hồi lượng | Có |
| Ghép nguồn theo năng lực, khoảng cách và chất lượng; tự kích hoạt nguồn dự phòng | 15-17 | Có gợi ý phân nguồn hàng loạt theo giá/lượng và duyệt tay; chưa có xếp hạng theo khoảng cách/Trust Score và tự chuyển nguồn khi Gate lỗi | Một phần |
| Demand Forecasting từ lịch sử, kế hoạch và mùa vụ | 17, 30 | Có kế hoạch nhập tay và tổng hợp nhu cầu đơn; chưa tìm thấy luồng dự báo tương ứng | Thiếu, theo lộ trình |
| Gate ba luồng, checklist, ảnh, tái kiểm | 15, 17, 29 | Có accepted/review/rejected, bằng chứng và reinspect | Có |
| AI quét ảnh ngoại quan rau/nấm | 17, 27 | Gate hiện là form nhân viên nhập kết quả; chưa tìm thấy API/màn hình phân tích ảnh hoặc mô phỏng AI ngoại quan | Thiếu cả demo chuyên biệt này |
| Lưu trạm dưới 3h, không qua đêm | 7, 15, 17, 28-29 | Có `received_at`; chưa có giám sát thời gian lưu, cảnh báo/chặn dùng lô tồn quá hạn hay KPI tương ứng | Một phần dữ liệu, thiếu kiểm soát |
| Ghép đơn/ghép chuyến theo địa lý và tải xe | 16-17, 27 | Có thuật toán chia cụm, giới hạn tải và nearest-neighbor, áp dụng tạo chuyến | Có bản hỗ trợ quyết định; chưa bảo đảm khung giao trước 10h |
| GPS và theo dõi giao hàng | 27, 46 | Có tài xế gửi vị trí trình duyệt, telemetry và điểm giao; dashboard tổng quan dùng danh sách xe viết sẵn; đơn nhà hàng chưa nối đầy đủ bản đồ vị trí | Một phần |
| QR hồ sơ vòng đời lô và chứng chỉ | 18, 27 | Có QR, chứng chỉ VietGAP, nhật ký, kết quả kiểm; thiếu ghi thời gian thu hoạch/đóng gói qua DTO hiện tại và thiếu lịch sử giao trong public trace | Một phần; còn lỗi dữ liệu hiển thị nghiêm trọng |
| Quét QR để nghiệm thu/khiếu nại ngay | 16, 18, 27 | Có nghiệp vụ nhận và khiếu nại trong trang đơn; public TracePage chưa có luồng điều hướng theo đơn để thực hiện hai thao tác này | Một phần, chưa xuyên suốt từ QR |
| OCR VietGAP/GlobalGAP, nhật ký nông hộ | 18 | OCR đang trích nguyên liệu/số lượng từ ghi chú/hóa đơn; Passport nhập tay thông tin chứng chỉ | Sai đối tượng OCR so với PDF |
| Coop Trust Score và ưu đãi khi >95 | 18, 24, 40 | Có điểm 5 thành phần và nút tính lại; không tính tỷ lệ đúng hẹn, chưa nối ưu đãi phí hoặc ưu tiên phân nguồn | Một phần, lệch tiêu chí |
| Hộ chiếu Xanh tự động cuối tháng | 18 | Có cấp chứng nhận, QR xác minh; chọn 30/60 ngày hoặc toàn thời gian, cấp theo yêu cầu; có giá trị mẫu khi không có dữ liệu | Một phần; chưa đúng cơ chế đo và kỳ báo cáo |
| Khiếu nại, bù hàng <2h, đền bù <24h | 16, 18, 29, 44 | Có hồ sơ, ghi chú, chuyển việc, hoàn tiền/điều chỉnh thủ công và tái giao; thiếu tự gán hạn, luồng bù hàng thực thi từ đề xuất và có lỗi API frontend | Một phần |
| Hủy muộn chịu phí; trễ giao có voucher; phạt 3PL | 16 | Hủy thông thường bị chặn sau cutoff; chưa có công thức phạt, voucher hoặc đối soát trách nhiệm với 3PL | Thiếu |
| Thu phí HTX 1.500/1.000 đồng/kg và nhà hàng 20.000 đồng/thùng | 8, 40 | Đối soát HTX dùng hoa hồng % nhập tay; tổng đơn bằng tiền hàng, chưa nối phí với thùng giao thực tế | Lệch chương doanh thu |
| Thu hồi thùng QR, vệ sinh, mất/hỏng/bồi hoàn | 27, 42 | Có cấp lên xe, giao, thu, vệ sinh, sự cố và phí sự cố; API tạo tài sản mặc định PP_CRATE | Có lõi; túi giữ nhiệt/chỉ số vòng quay chi tiết còn hạn chế |
| Thu gom bao bì sạch, phân loại và chuyển đối tác tái chế | 30, 43 | Chưa thấy module khối lượng/vật liệu/đối tác bàn giao | Thiếu, giai đoạn sau |
| Tái phân bổ hàng dư HTX/trạm theo thời hạn và cùng tuyến | 43-44 | Có nhãn GRADE_B_RESCUE, lý do và % giảm trên sản phẩm; chưa có workflow theo lô, thời hạn 05h30/07h30, niêm phong và kiểm lại trước chào bán | Một phần ý tưởng, thiếu nghiệp vụ chính |
| Thông báo điện thoại/Zalo | 24 | Có thông báo nội bộ, email outbox, nút Zalo/hotline; chưa có gửi thông báo Zalo/SMS, số liên hệ là placeholder | Một phần |
| KPI vận hành và hiệu quả kinh tế | 28-29 | Có KPI đơn/giao/QC/khiếu nại/công nợ; chưa đầy đủ lưu trạm, không tồn qua đêm, vòng quay thùng, khách đặt lại, biên đóng góp/đơn | Một phần |
| Sampling, subscription báo cáo thị trường, POS/kho | 30, 41 | Chưa thấy luồng triển khai tương ứng | Thiếu so với toàn đề án, không phải yêu cầu bắt buộc của MVP |

## 3. Những điểm lệch quan trọng và bằng chứng code

### A. Giờ chốt đang là 17h

- `backend/src/main/java/vn/freshlink/ordering/OrderingService.java:20,42`: mặc định `app.order.cutoff:17:00`, kiểm tra khi tạo đơn.
- `OrderWorkflowController.java:22,29,75`: cùng mặc định, dùng cho sửa/duyệt/hủy.
- `RestaurantWorkspaceController.java:19`: endpoint trả lịch đặt đơn cũng theo 17h.
- `frontend/src/pages/RestaurantPage.tsx:91`: fallback hiển thị 17h.

Ví dụ: lúc 20h ngày T-1, PDF cho phép đặt cho ngày T, nhưng code mặc định đã từ chối. Có thể cấu hình deployment ghi đè; chưa kiểm tra biến môi trường của máy chủ đang chạy nên kết luận này áp dụng cho mặc định code.

### B. Hai loại phí chưa khớp

- `billing/SettlementController.java:22-30,54-73`: `commission = gross × commission_rate / 100`, dùng lượng đạt tại Gate.
- `billing/BillingController.java:38`: số phải trả HTX cũng trừ hoa hồng phần trăm.
- `frontend/src/pages/SourcingWorkbench.tsx:10,21`: điều phối nhập “Hoa hồng %”, mặc định 0.
- `ordering/OrderingService.java:62`: `total_amount = subtotal`; trường `service_fee`/`delivery_fee` trong schema chưa được nối với số thùng giao thực tế.

Chưa có cơ chế lấy điểm >95 để tự áp dụng 1.000 đồng/kg và chưa có khoản 20.000 đồng × số thùng thực giao. Cũng cần thống nhất “lượng đạt Gate” với “lượng giao thành công” ở chương doanh thu trước khi sửa đối soát.

### C. QR có thể hiển thị thông tin mẫu như dữ liệu của lô

- `frontend/src/pages/TracePage.tsx:81`: nhật ký canh tác mặc định.
- `TracePage.tsx:428,438,443,524,529,534`: tự điền giống, ngày, thời điểm thu hoạch/đóng gói, cơ sở sơ chế, trạng thái tiếp nhận khi dữ liệu thiếu.
- `TracePage.tsx:541`: dòng nhiệt độ duy trì liên tục viết cố định.
- `TracePage.tsx:556-574`: cả bốn tiêu chí luôn hiển thị PASS, không lấy kết quả từng checklist từ backend.
- `traceability/TraceController.java:186-193`: lấy chứng chỉ APPROVED nhưng truy vấn này không lọc hạn chứng chỉ, dù endpoint chứng chỉ công khai riêng có lọc.
- `quality/QualityService.java:18-25,51`: DTO tạo lô chưa nhận `harvest_at`/`packed_at`; không thể coi các trường schema là dữ liệu đã được thu thập đầy đủ.
- `TraceController.java:166-243`: public trace chưa trả lịch sử giao nhận theo đơn/lô.

Đây là điểm cần sửa trước demo: lô chưa kiểm hoặc kiểm không đạt không nên hiện tất cả PASS; thiếu nhật ký phải hiển thị chưa có dữ liệu. Dữ liệu minh họa có thể giữ trong chế độ demo riêng, có nhãn rõ ràng.

### D. OCR đang phục vụ một nhu cầu khác

- `ocr/SmartOcrService.java:223-231`: prompt đọc giấy ghi nguyên liệu, hóa đơn, số lượng.
- `sourcing/PassportController.java:21-32`: chứng chỉ vẫn nhận số, cơ quan cấp, ngày cấp/hết hạn do người dùng nhập.
- `SmartOcrService.java:98-110,483-487`: khi thiếu API key hoặc nhận diện thất bại, trả danh sách mẫu cải thảo 5kg, rau muống 10kg, nấm 2 gói; không phải kết quả đọc ảnh đó.

OCR đặt hàng là tính năng bổ sung có ích, nhưng không thay thế OCR chứng chỉ/nhật ký trong PDF. Với ảnh không đọc được, cần báo lỗi hoặc yêu cầu nhập tay, không dùng kết quả mẫu để tạo cảm giác đã nhận diện thành công.

### E. Ghép nguồn, dự báo và AI Gate

- `frontend/src/pages/SourcingWorkbench.tsx:11,14-18`: gợi ý dựa trên SKU/ngày/lượng và giá tăng dần; lựa chọn riêng dùng chất lượng làm tiêu chí phụ. Người vận hành bấm xác nhận.
- `sourcing/SourcingService.java:30-48`: giữ lượng theo yêu cầu được gửi; chưa có bộ phân bổ động theo khoảng cách, Trust Score.
- `quality/QualityService.java:81-87`: khi lượng bị loại, giải phóng phần nguồn dự kiến; không tự gọi HTX dự phòng.
- `ordering/WeeklyPlanController.java:22-38`: lưu/xem kế hoạch nhập tay, chưa có mô hình dự báo lịch sử/mùa vụ và thông báo forecast cho HTX.
- `quality/QualityController.java:26` và `frontend/src/pages/OperationsPage.tsx:228-232`: Gate là kiểm nhận do nhân viên nhập, có ảnh bằng chứng. Chưa có phân tích ảnh độ tươi.

PDF giai đoạn 1 chỉ cần mô phỏng AI ngoại quan, không nhất thiết huấn luyện mô hình thị giác thật ngay. Nhưng chức năng mô phỏng này vẫn chưa thấy trong luồng Gate hiện tại.

### F. Tối ưu chuyến có code thật, nhưng chưa đủ lời hứa SLA

- `delivery/AiDispatchService.java:257-303,354-425`: chia cụm theo tọa độ/tải, sắp điểm gần nhất và ước lượng vận tốc 25 km/h.
- `AiDispatchService.java:433-480`: Gemini chủ yếu viết lời giải thích phương án đã được thuật toán tính.
- Chưa thấy ràng buộc cửa sổ giờ nhận trong thuật toán xếp tuyến hoặc điều kiện chứng minh tất cả điểm hoàn thành trước 10h. Không nên giới thiệu là luôn tìm được đường ngắn nhất hay chắc chắn đạt SLA.
- `AiDispatchService.java:331`: tỷ lệ tiết kiệm bị chặn tối thiểu 15%, nên có thể vẫn báo tiết kiệm dù ước tính chi phí không tốt hơn phương án đối chiếu.
- `delivery/LateDeliveryMonitor.java:6-7`: cảnh báo trễ theo ETA/planned time hơn 10 phút; chưa phát voucher, chưa xử lý phạt 3PL.
- `DeliveryService.java:40`: tạo stop chưa đặt `planned_arrival_at`; nếu ETA cũng chưa được nhập thì monitor không có mốc để so.

### G. Coop Trust Score và Supplier Passport chưa đúng bộ tiêu chí

- `esg/CoopTrustScoreService.java:33-145`: 5 thành phần là QC, lượng HTX xác nhận, giấy tờ, số khiếu nại và số lô thành công. Không có thành phần đo giao đúng giờ.
- `esg/CoopTrustController.java:31-44`: có endpoint tính lại; chưa thấy job hoặc domain event tự cập nhật điểm sau mọi sự kiện.
- Phí và phân nguồn không sử dụng ngưỡng >95.
- `sourcing/PassportController.java:17-19`: chủ yếu là hồ sơ chứng chỉ; chưa phải đủ dashboard 5 KPI Supplier Passport ở PDF trang 28-29, nhất là đúng hẹn, giao đủ thực tế và tính đầy đủ truy xuất.

### H. Chứng nhận Xanh chưa phải báo cáo đo lường cuối tháng

- `esg/EsgCertificateService.java:48-60`: khoảng trượt 30/60 ngày hoặc từ 01/01/2026, mặc định 60 ngày.
- `EsgCertificateService.java:94-109`: ước lượng số thùng bằng số đơn ×12 hoặc số movement; không có dữ liệu vẫn trả 600 thùng, 150kg nhựa, 45kg CO2, 24 đơn.
- `EsgCertificateService.java:128-139`: HTX cũng có nhánh số liệu mẫu khi chưa có lô.
- `EsgCertificateService.java:176-184`: có thể lưu các số liệu đó vào chứng nhận với `verified_by_freshlink = TRUE`.
- `esg/EsgCertificateController.java:36-45`: cấp theo request; chưa thấy lịch tự tạo báo cáo cuối tháng.

Cần tính từ sự kiện luân chuyển và phương pháp ước tính có nguồn dữ liệu rõ, phân biệt số đo với ước tính; không phát chứng nhận xác thực cho số liệu mẫu.

### I. Khiếu nại và giao nhận có lỗi nối API

| Lỗi | Bằng chứng | Tác động suy ra từ code |
|---|---|---|
| Đóng hồ sơ gửi sai payload | `frontend/src/pages/WorkspacePages.tsx:399` gửi `{finalResolution, refundAmount}`; `claims/ClaimDossierController.java:182-199` bắt buộc `{reason}` | Request hiện tại không đáp ứng validation; ô số tiền hoàn không thực hiện hoàn tiền qua endpoint này |
| Lọc quá hạn sai tên tham số | `frontend/src/pages/OperationsPage.tsx:253` gửi `overdueOnly=true`; `ClaimDossierController.java:34,61` đọc `slaOverdue` | Bộ lọc quá hạn không được áp dụng |
| Chưa đặt hạn khiếu nại mới | `claims/ClaimController.java:26` không ghi hai cột hạn; migration V10 dòng 56-60 thêm hai cột nullable | Chưa có dữ liệu để thực thi SLA 2h/24h cho khiếu nại mới |
| Tài xế báo đến thiếu tọa độ | `frontend/src/pages/TripPage.tsx:196` POST không body; `delivery/DeliveryWorkflowController.java:13,19` yêu cầu Location có latitude/longitude | Nút báo đến không đáp ứng hợp đồng API |
| Chấp thuận REDELIVERY chưa tạo giao bù | `ordering/OrderRemedyController.java:178-218` không có nhánh thực thi REDELIVERY; endpoint tái giao riêng nằm ở `DeliveryService.java:50` | Chấp thuận đề xuất không đồng nghĩa đã có chuyến/lô hàng bù |

Đã có endpoint hoàn tiền và điều chỉnh công nợ thủ công trong `billing/SettlementController.java:104-122`; vì vậy kết luận đúng là **chưa hoàn thiện luồng liền mạch**, không phải hoàn toàn không có đền bù.

### J. Hàng dư chưa phải workflow tái phân bổ

- `V14__imperfect_produce_and_ai_smart_ocr.sql` và `catalog/CatalogController.java:126-165`: phân loại GRADE_B_RESCUE là thuộc tính sản phẩm.
- Chưa thấy bảng/endpoint quản lý lượng dư theo lô và vị trí, thời hạn chào bán, tình trạng niêm phong, kiểm đạt trước tái phân bổ hay chọn nhà hàng cùng tuyến.
- `quality/QualityService.java:38` không cho khai báo vượt lượng cung ứng đã chốt; chưa có luồng tiếp nhận riêng cho hàng HTX giao thừa như PDF trang 44.
- `OrderingService.java:42` chặn đơn sau cutoff, nên chưa có ngoại lệ mua hàng dư trong đêm trước ca gom sáng như PDF trang 43-44.

Không tìm thấy luồng chủ động thu hồi thực phẩm đã vào bếp để bán lại; không kết luận code đang làm việc đó. Tuy nhiên, workflow hàng dư mới cần kiểm soát rõ nguồn gốc/vị trí, để chỉ tái phân bổ hàng còn trong vùng kiểm soát hợp lệ.

### K. KPI và logistics ngược

- `assets/AssetController.java:35-68`: có thùng chuyển trạng thái và ghi vệ sinh; `system/PlatformFeaturesController.java:16` có sự cố và số phí bồi hoàn.
- Schema có loại túi giữ nhiệt nhưng `AssetController.java:20` chỉ tạo PP_CRATE. Chưa có đầy đủ quy trình riêng của túi và vật liệu tái chế.
- `system/PlatformFeaturesController.java:11`: có KPI tổng hợp, thời gian xử lý khiếu nại trung bình; chưa đủ KPI lưu trạm dưới 3h, tồn qua đêm, thu hồi nguyên vẹn chuyến tiếp theo, khách đặt lại và biên đóng góp/đơn.
- `common/EmailOutboxWorker.java` xử lý email; nút Zalo/hotline trong `FloatingSupportWidget.tsx` dùng số mẫu, không phải tích hợp gửi thông báo nghiệp vụ.

## 4. Phần thừa hoặc nên ẩn khỏi demo bản chốt

| Nội dung hiện có | So với PDF | Cách xử lý đề xuất |
|---|---|---|
| Hub Hà Nội, Mộc Châu, Đà Lạt, Củ Chi; nhiều trung tâm chuỗi lạnh | Vượt phạm vi thí điểm một trạm, hai quận | Demo chỉ dùng trạm/địa bàn thí điểm; giữ khả năng mở rộng trong kiến trúc |
| Xe, nhiệt độ, độ ẩm, số xe/công suất viết sẵn | Không chứng minh được giám sát vận hành thật | Dùng dữ liệu API thực hoặc ghi rõ chế độ mô phỏng |
| Chatbot/trợ lý AI tư vấn | PDF không yêu cầu thành module chính | Có thể giữ phụ trợ; không ưu tiên hơn Gate/QR/đối soát |
| OCR hóa đơn/ghi chú đầu bếp | Bổ sung ngoài OCR chứng chỉ của PDF | Giữ nếu hữu ích, nhưng gọi đúng tên và tách khỏi tuyên bố đã có OCR VietGAP |
| Nội dung bán hàng giải cứu rộng sang dưa hấu, hoa quả/juice bar | Vượt ngách rau lá lẩu và nấm của giai đoạn 1 | Thu gọn nội dung/dữ liệu demo; không cần xóa khả năng danh mục mở rộng |

Bằng chứng: `delivery/HubController.java:44-75,100-105`, `frontend/src/pages/WorkspacePages.tsx:33-46`, `frontend/src/components/SmartOcrModal.tsx`, `frontend/src/components/FloatingSupportWidget.tsx`, `backend/src/main/java/vn/freshlink/chat/ChatController.java`.

Không nên coi phân quyền QC/CSKH/kế toán, audit, quản lý hồ sơ, công nợ, idempotency hay email là chức năng thừa cần xóa. Đây là phần hỗ trợ hợp lý để thực hiện quy trình trong PDF. Kế hoạch tuần, Passport, Trust Score, ESG có thể là tính năng làm sớm hơn lộ trình, nhưng không ngoài toàn bộ đề án.

## 5. Những điểm chính PDF cần thống nhất

1. **Biểu phí HTX:** trang 18 ghi giảm từ 5% xuống 2% khi điểm >95; trang 8 và trang 40 ghi 1.500 xuống 1.000 đồng/kg. Code hiện theo phần trăm, nhưng cũng chưa có tự giảm theo điểm. Đề xuất lấy chương 5.4 làm cơ sở khi nhóm xác nhận, rồi sửa đồng bộ trang 18 và code.
2. **Mốc SLA khiếu nại:** trang 16/18 có bù hàng hoặc trừ nợ dưới 2h; trang 8/29/44 có đền bù dưới 24h. Có thể tách phản ứng/giao bù 2h và quyết toán 24h, nhưng cần định nghĩa rõ thời điểm bắt đầu và hoàn tất.
3. **Khung giờ giao:** mục tiêu trước 10h, nhưng bảng bước nghiệm thu có 09h30-10h30. Cần tách rõ giờ hàng đến và giờ hoàn tất ký nhận/đối soát để tính KPI.
4. **Khóa đơn và hủy muộn:** khóa thường lúc 22h, nhưng có ma trận hủy/giảm sau 24h. Cần quy trình ngoại lệ do điều phối duyệt, không chỉ mở lại nút hủy thông thường.
5. **Phạm vi MVP:** chương tính năng mô tả đích đến toàn đề án; chương lộ trình chỉ yêu cầu prototype ở giai đoạn đầu. Nên gắn nhãn tính năng demo/đang phát triển/giai đoạn sau trong bài thuyết trình.

## 6. Thứ tự nên xử lý

### Ưu tiên 1: trước buổi demo

- Sửa QR lấy đúng kết quả QC, chứng chỉ hợp lệ; bỏ dữ liệu mẫu khỏi hồ sơ thật.
- Đổi mặc định cutoff sang 22h, kiểm tra các mốc trước/đúng/sau giờ chốt.
- Sửa API báo đến, đóng khiếu nại và bộ lọc SLA; phân biệt đóng hồ sơ với hoàn tiền thực tế.
- Giới hạn bản demo vào rau lẩu/nấm, một cross-dock, Cầu Giấy-Đống Đa; gắn nhãn mô phỏng cho dữ liệu bản đồ còn giả lập.
- Bổ sung demo AI ngoại quan tại Gate nếu muốn đáp ứng đúng mô tả giai đoạn 1.
- Không cấp chứng nhận Xanh hoặc kết quả OCR từ số liệu mẫu không liên quan dữ liệu đầu vào.

### Ưu tiên 2: trước vận hành/thu phí giai đoạn 2

- Chốt một biểu phí, triển khai phí/kg và phí/thùng cùng quy tắc Trust Score.
- Thỏa thuận tháng, giá trần, khoảng giá dự kiến.
- Theo dõi lưu trạm và hạn sử dụng; SLA giao/khiếu nại, voucher/phạt theo ma trận.
- Hoàn thiện hàng dư theo lô, nguồn dự phòng, OCR chứng chỉ và hồ sơ vòng đời.
- Nối GPS thật vào màn hình nhà hàng; báo cáo Xanh theo tháng có dữ liệu nguồn.

### Ưu tiên 3: theo lộ trình mở rộng

- AI dự báo mùa vụ, tối ưu tuyến có khung giờ và dữ liệu giao thực tế.
- POS/kho, tái chế, sampling, subscription báo cáo thị trường.

## 7. Kiểm tra đã chạy và giới hạn

- Frontend: `npm run build` thành công; TypeScript và Vite build qua. Có cảnh báo bundle lớn hơn 500kB, không phải lỗi chức năng.
- Backend: chạy chọn 11 lớp test không yêu cầu MySQL nghiệp vụ, tổng **35 test, 0 failure, 0 error, 0 skipped**. Các lớp: IdentityServiceTest, ApiExceptionHandlerTest, CloudinaryMediaStorageTest, MediaControllerTest, SystemControllerTest, ChatControllerTest, AiDispatchTest, CoopTrustScoreTest, EsgCertificateTest, SmartOcrTest, VietgapTraceabilityTest.
- Chưa chạy các integration test có điều kiện `FRESHLINK_INTEGRATION=true`, chưa thao tác end-to-end với database thật, chưa kiểm chứng bản triển khai online, provider AI/email hoặc thiết bị IoT.
- Test đạt không chứng minh PDF được đáp ứng. Một số test ESG hiện kiểm tra công thức/QR mẫu, không kiểm chứng dữ liệu đo lường hay lịch tự cấp hàng tháng.
- Các kết luận “chưa thấy/chưa có” dựa trên mã nguồn hiện tại; quy trình làm ngoài phần mềm hoặc cấu hình riêng trên deployment có thể bổ sung một phần nhưng chưa được xác minh ở lần rà soát này.

Tài liệu cũ `docs/FRONTEND-BACKEND-GAPS.md` có một số dòng chưa cập nhật sau các bản mở rộng. Kết quả này dựa vào code hiện tại thay vì coi danh sách cũ là nguồn kết luận.
