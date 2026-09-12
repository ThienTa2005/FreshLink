# Bộ prompt sinh giao diện FreshLink

Các prompt dưới đây dùng cho Figma AI, Lovable, Bolt, v0 hoặc công cụ sinh React tương đương. Chạy **Prompt 00** trước để tạo nền tảng chung. Sau đó chạy từng prompt trang trong cùng một project. Không tạo project mới cho mỗi prompt.

## Prompt 00 — Nền tảng chung và prototype contract

```text
Xây dựng design system và application shell dùng chung cho toàn bộ website FreshLink, một nền tảng điều phối thực phẩm tươi B2B tại Việt Nam. Đây là nền móng bắt buộc; mọi màn hình được sinh sau phải tái sử dụng đúng component, token, route và mock data trong project này, không tự tạo header/sidebar/style khác.

Tech target: React 18 + TypeScript + Vite + React Router + Ant Design 5 + TanStack Query. Prototype phải chạy được bằng npm run dev, không có TypeScript error, không dùng backend thật nếu chưa cấu hình; tạo mock API adapter và seed data để mọi thao tác demo hoạt động. Chuẩn bị API adapter để đổi sang VITE_API_URL và response envelope {success,data,message,timestamp}. Mutation phải có loading, disable double-submit, toast thành công, inline error; thao tác quan trọng có confirm modal. Các POST nghiệp vụ tạo Idempotency-Key bằng crypto.randomUUID() và giữ nguyên key khi retry cùng payload.

Phong cách: clean agricultural logistics SaaS, chuyên nghiệp, dễ đọc, không giống trang thương mại điện tử đại trà. Màu primary xanh lá đậm #176B45, secondary xanh non #8FBF5A, accent cam ấm #F59E42, nền #F6F8F5, surface trắng, text #173128, danger #D14343, warning #D99020. Font Be Vietnam Pro hoặc Inter hỗ trợ tiếng Việt. Border radius 10–14px, shadow nhẹ, grid 8px. Không gradient quá mạnh, không glassmorphism, không ảnh stock lạm dụng. WCAG AA, focus ring rõ, keyboard navigation, label luôn hiển thị, không dùng màu làm tín hiệu duy nhất.

Tạo component dùng chung: PublicHeader, PublicFooter, PortalShell, PortalHeader, PortalSidebar, MobileBottomNav, Breadcrumbs, PageHeader, OrganizationSwitcher, UserMenu, NotificationBell, GlobalSearch, StatusBadge, KpiCard, FilterBar, DataTable, EmptyState, ErrorState, SkeletonState, ConfirmActionModal, FormDrawer, DetailDrawer, Timeline, EvidenceUploader, Money, Quantity, DateTimeVN và PermissionGate.

PublicHeader dùng ở /, /login, /register, /trace/:code, /suppliers/:id/certificates: logo FreshLink về /; link Giải pháp, Quy trình, Truy xuất; nút Đăng nhập và Đăng ký hợp tác. PublicFooter giống nhau trên mọi trang public: logo, mô tả ngắn, liên kết Chính sách bảo mật/Hỗ trợ/Truy xuất và dòng “Thí điểm tại Cầu Giấy và Đống Đa, Hà Nội”. Login/register có thể dùng bản header rút gọn nhưng logo, màu và footer vẫn cùng component.

PortalShell dùng ở mọi route /portal/*: desktop có sidebar cố định 256px; tablet sidebar thu gọn; mobile dùng drawer và bottom navigation. PortalHeader có logo về /portal, OrganizationSwitcher nếu user có nhiều đơn vị, GlobalSearch, NotificationBell, avatar/UserMenu, đăng xuất. Sidebar render theo role, không chỉ ẩn bằng CSS. Nhóm menu: Tổng quan; Đơn hàng; Cung ứng; Lô & kiểm hàng; Chuyến giao; Khiếu nại; Tài chính; Thùng; Thành viên; Phân tích; Quản trị. Breadcrumb và PageHeader nhất quán. Nội dung max-width 1440px.

Vai trò: RESTAURANT_PURCHASER, RESTAURANT_MANAGER, RESTAURANT_RECEIVER, SUPPLIER_STAFF, SUPPLIER_MANAGER, OPERATIONS_COORDINATOR, QUALITY_INSPECTOR, DRIVER, CUSTOMER_SUPPORT, ACCOUNTANT, ASSET_MANAGER, SYSTEM_ADMIN. Tạo role switcher chỉ trong prototype dev để kiểm tra menu và quyền.

Quy ước trạng thái: badge có label tiếng Việt và tooltip giải thích; map tập trung trong một file. Dates hiển thị Asia/Ho_Chi_Minh, tiền VND, số lượng tối đa 3 chữ số thập phân. Table có search/filter/sort/pagination, sticky action column, responsive card list trên mobile. URL giữ filter/page để back/forward hoạt động.

Tạo routes và liên kết đầy đủ: /, /login, /register, /trace/:code, /suppliers/:id/certificates, /portal/dashboard, /portal/orders, /portal/orders/new, /portal/orders/:id, /portal/supply-requests, /portal/batches, /portal/quality, /portal/trips, /portal/trips/:id, /portal/claims, /portal/claims/:id, /portal/invoices, /portal/assets, /portal/members, /portal/notifications, /portal/analytics, /portal/admin/security. Route không có quyền hiển thị trang 403 có nút về dashboard; route không tồn tại hiển thị 404. Breadcrumb, menu active state và browser back phải đúng.

Tạo mock entities có ID ổn định và đủ mọi trạng thái. Prototype interaction phải thực sự cập nhật mock state: tạo/sửa/hủy/duyệt, filter, modal/drawer, notification read, reorder stop bằng drag-and-drop. Không để nút giả không phản hồi. Có loading, empty, error, offline/server-warming states. Toàn bộ microcopy bằng tiếng Việt chuẩn Unicode, không lorem ipsum, không chuỗi lỗi font.
```

## Prompt 01 — Trang chủ `/`

```text
Trong project FreshLink hiện tại, tạo trang chủ route /. Bắt buộc tái sử dụng PublicHeader và PublicFooter từ Prompt 00, không định nghĩa header/footer mới. Hero truyền tải “Đúng nguồn. Đúng chuẩn. Đúng giờ.” với CTA Đăng ký hợp tác -> /register và Đăng nhập -> /login. Bố cục gồm: hero với minh họa chuỗi cung ứng rau/nấm; dải trust metrics ghi rõ dữ liệu minh họa; 4 thẻ Nhà hàng/Nhà cung cấp/FreshLink Gate/Tài xế; timeline 5 bước đặt hàng–phân nguồn–kiểm nhận–ghép chuyến–giao; lợi ích truy xuất QR; CTA cuối trang. Link anchor trên PublicHeader cuộn đúng section. Responsive hoàn chỉnh, animation nhẹ và tôn trọng prefers-reduced-motion. Prototype mọi CTA và nav đều điều hướng được.
```

## Prompt 02 — Đăng nhập `/login`

```text
Tạo trang /login trong project FreshLink, dùng PublicHeader rút gọn và PublicFooter chung. Desktop chia hai cột: trái là brand story ngắn, phải là form; mobile chỉ giữ form và brand compact. Form gồm email, mật khẩu, hiện/ẩn mật khẩu, ghi nhớ email, link hỗ trợ. Có các state server warming, server slow, network error, sai thông tin, tài khoản khóa và loading. Submit mock thành công điều hướng /portal/dashboard, giữ returnUrl an toàn nếu có. Nếu đã đăng nhập thì redirect portal. Không thêm social login. Validation tiếng Việt, focus vào lỗi đầu tiên, Enter submit, không mất dữ liệu khi request lỗi.
```

## Prompt 03 — Đăng ký đối tác `/register`

```text
Tạo trang /register, dùng PublicHeader/PublicFooter chung. Form wizard 3 bước: loại đối tác (Nhà hàng hoặc Nhà cung cấp), thông tin đơn vị, thông tin tài khoản quản trị. Trường khớp API: type RESTAURANT|SUPPLIER, organizationName, fullName, email, password. Hiển thị password strength và điều khoản. Có summary trước khi gửi, back không mất dữ liệu, duplicate email error và success state “Hồ sơ chờ quản trị viên duyệt” với link /login. Prototype stepper, validation và submit hoạt động bằng mock adapter.
```

## Prompt 04 — Truy xuất QR `/trace/:code`

```text
Tạo trang công khai /trace/:code, tái sử dụng PublicHeader/PublicFooter. Thiết kế mobile-first vì mở từ QR. Header nội dung có trạng thái xác thực, mã QR, loại đối tượng. Với lô hàng hiển thị sản phẩm, nhà cung cấp, nguồn gốc, thu hoạch/đóng gói/kiểm nhận, kết quả kiểm tra và timeline hành trình; với thùng hiển thị mã, tình trạng và lịch sử luân chuyển đã được phép công khai. Có skeleton, QR sai/hết hạn/thu hồi, retry và nút xem chứng nhận nhà cung cấp -> /suppliers/:id/certificates. Không hiển thị giá, restaurant_id, dữ liệu cá nhân hay URL file riêng tư.
```

## Prompt 05 — Chứng nhận nhà cung cấp `/suppliers/:id/certificates`

```text
Tạo trang công khai xác thực chứng nhận nhà cung cấp tại /suppliers/:id/certificates, dùng PublicHeader/PublicFooter chung. Hero nhỏ hiển thị tên, mã và trạng thái ACTIVE. Danh sách chứng nhận dạng card: loại, số, ngày cấp, ngày hết hạn, trạng thái VERIFIED, dấu xác minh và cảnh báo sắp hết hạn. Có filter theo loại và trạng thái empty/not-found. Không cho tải file private. Nút quay lại trang truy xuất dùng browser back nếu có, nếu không về /. Prototype dùng GET /public/suppliers/{id}/certificates qua mock adapter.
```

## Prompt 06 — Dashboard theo vai trò `/portal/dashboard`

```text
Tạo dashboard /portal/dashboard trong PortalShell chung. Nội dung thay đổi theo role nhưng layout nhất quán: PageHeader có ngày, nút làm mới; 4–6 KpiCard; hàng “Việc cần xử lý”; biểu đồ xu hướng; hoạt động gần đây. Nhà hàng thấy đơn sắp giao/công nợ; supplier thấy yêu cầu mới/lô bị cách ly; operations thấy thiếu nguồn/chuyến trễ; quality thấy lô chờ kiểm; driver thấy chuyến hôm nay; CSKH thấy SLA khiếu nại; accountant thấy quá hạn; admin thấy hồ sơ và cảnh báo. Mỗi card click đến route liên quan kèm query filter. Tạo loading/error/empty và tooltip định nghĩa KPI. Dùng GET /analytics/kpis?from=&to= cho dữ liệu tổng hợp.
```

## Prompt 07 — Danh sách và tạo đơn `/portal/orders`, `/portal/orders/new`

```text
Tạo module đơn hàng gồm /portal/orders và /portal/orders/new trong PortalShell. Trang danh sách có KPI mini, filter mã/ngày/trạng thái/approval/payment, table responsive và action theo trạng thái: xem, sửa, gửi duyệt, duyệt/từ chối, hủy, đặt lại. Nút Tạo đơn tới /portal/orders/new. Trang tạo đơn gồm chọn ngày giao, catalog có search/category/giá/nguồn dự kiến, input quantity theo minimum và step, sticky cart summary, địa chỉ và khung nhận; tổng tiền VND. Nếu purchaser tạo xong cho phép gửi duyệt; manager có thể xác nhận. Confirm modal trước gửi, idempotency key, success chuyển /portal/orders/:id. Sửa dùng cùng form nhưng gọi PUT /orders/{id}; khóa form và giải thích khi qua giờ chốt hoặc đơn đã xử lý.
```

## Prompt 08 — Chi tiết đơn `/portal/orders/:id`

```text
Tạo trang chi tiết đơn /portal/orders/:id trong PortalShell. PageHeader có mã, StatusBadge order/approval/payment và action hợp lệ theo quyền. Sections: thông tin giao; người tạo/người duyệt; bảng dòng hàng; tiền; timeline trạng thái; nguồn cung và lô được phân bổ; chuyến/điểm giao; xác nhận nhận hàng; khiếu nại liên quan. Action sửa, submit-approval, approve/reject và cancel gọi đúng endpoint, dùng modal yêu cầu lý do, xử lý 409 bằng thông báo rõ và refetch snapshot. Receiver có form xác nhận hàng sau giao. Có nút tạo đánh giá supplier chỉ khi DELIVERED. Mobile biến tables thành cards.
```

## Prompt 09 — Cung ứng `/portal/supply-requests`

```text
Tạo trang /portal/supply-requests dùng PortalShell, phục vụ operations và supplier với PermissionGate. Operations có demand board theo ngày, panel offer phù hợp, form tạo supply request, table yêu cầu và action sửa/hủy trước khi supplier tiếp nhận. Khi sửa dùng PUT /operations/supply-requests/{id}; khi hủy dùng POST /operations/supply-requests/{id}/cancel và cảnh báo lượng sẽ được hoàn. Supplier thấy inbox yêu cầu, chi tiết SKU/ngày/điểm Gate/lượng/giá, nhập lượng chấp nhận 0..requested và phản hồi. Dùng drawer chi tiết, badge trạng thái, filter và optimistic UI chỉ cho selection; mutation luôn refetch. Hiển thị rõ reserved/available để tránh vượt nguồn.
```

## Prompt 10 — Lô hàng nhà cung cấp `/portal/batches`

```text
Tạo trang /portal/batches trong PortalShell. Supplier thấy danh sách lô, nút khai báo lô từ supply request đã chấp nhận, form quantity và origin, upload hồ sơ/bằng chứng, QR action. Lô CREATED có Sửa và Hủy; sau Gate tiếp nhận hai nút disabled kèm tooltip. Chi tiết drawer hiển thị quantities declared/received/accepted/review/rejected/allocated, inspection timeline, lý do từ chối và hồ sơ cần bổ sung. Operations/quality có read access phù hợp. Gọi POST /batches, PUT /batches/{id}, POST /batches/{id}/cancel, GET /batches/{id}, POST /qr/BATCH/{id}. Prototype cập nhật trạng thái thật trong mock store.
```

## Prompt 11 — Kiểm hàng `/portal/quality`

```text
Tạo work queue kiểm hàng /portal/quality trong PortalShell cho QUALITY_INSPECTOR. Hai tab Chờ kiểm và Cách ly cần kiểm lại. Mỗi lô có mã, supplier, SKU, lượng, thời gian chờ và CTA. Inspection workspace có ảnh/bằng chứng, checklist Specification/Packaging/Label/Appearance, ba quantity accepted/review/rejected với live total validation không vượt declared, note bắt buộc. Reinspection chỉ cho lô QUARANTINED; accepted + rejected phải đúng review_quantity và gọi POST /batches/{id}/reinspect với Idempotency-Key. Sau submit hiển thị kết quả, timeline round 1/2… và refetch queue. Cảnh báo unsaved changes khi rời trang.
```

## Prompt 12 — Chuyến giao cho điều phối `/portal/trips`

```text
Tạo trang điều phối chuyến /portal/trips trong PortalShell. Có calendar/date filter, KPI chuyến planned/in-progress/late/completed, table và map placeholder không phụ thuộc API key. Form tạo chuyến chọn origin, driver và orders đủ allocation; preview stop list. Detail/edit drawer cho đổi tài xế, origin và drag-and-drop stopIds; save gọi PUT /trips/{id}. Hủy gọi POST /trips/{id}/cancel với reason. Chỉ PLANNED/LOADING được sửa/hủy; state khác disable kèm lý do. Hiển thị ETA, last location freshness và cảnh báo trễ tính từ eta/planned arrival. Nút mở chi tiết tới /portal/trips/:id.
```

## Prompt 13 — Chuyến của tài xế `/portal/trips/:id`

```text
Tạo trang mobile-first cho tài xế tại /portal/trips/:id, vẫn dùng PortalHeader compact và MobileBottomNav chung. Đầu trang có mã chuyến, trạng thái, progress stops, CTA bắt đầu chuyến. Mỗi điểm giao là card theo sequence với địa chỉ, người nhận, gọi điện, mở Google Maps, ETA và trạng thái. Khi IN_PROGRESS: nút cập nhật vị trí bằng Geolocation API với fallback nhập tay; Báo đã đến gọi /stops/{id}/arrive; Giao hàng mở form quantities/evidence; Giao thất bại mở sheet chọn lý do chuẩn hóa và note rồi gọi /stops/{id}/fail. Có offline queue indicator trong prototype, tránh submit trùng, giữ Idempotency-Key cho proof, nút giao/thu thùng. Điểm hoàn tất tự collapse nhưng vẫn xem lại được.
```

## Prompt 14 — Khiếu nại CSKH `/portal/claims`, `/portal/claims/:id`

```text
Tạo module CSKH gồm queue /portal/claims và workspace /portal/claims/:id trong PortalShell. Queue có SLA counters, filter status/type/assignee/restaurant, saved views “Mới”, “Của tôi”, “Chờ đối tác”, “Sắp quá SLA”. Detail layout 3 cột desktop: thông tin đơn/lô, conversation & evidence timeline, action panel; mobile xếp dọc. Hành động Nhận xử lý, Chuyển phụ trách, Chờ đối tác, Từ chối, Giải quyết, Đóng phải tuân theo state graph và gọi PATCH /claims/{id}/status hoặc /resolve. Note bắt buộc, action nguy hiểm có confirm, 409 refetch. Cho tải evidence qua signed access URL và không public file.
```

## Prompt 15 — Hóa đơn và công nợ `/portal/invoices`

```text
Tạo trang kế toán /portal/invoices trong PortalShell. Tabs Tổng quan, Hóa đơn, Quá hạn. KPI tổng phải thu/đã thu/quá hạn; aging buckets 0–7, 8–30, 31–60, >60 ngày. Table có invoice code, order, restaurant, issued, due, total, paid, balance, status; filter và export. Drawer phát hành hóa đơn gọi POST /billing/invoices với orderId,dueDate,taxAmount,note; drawer ghi nhận payment liên kết API payment hiện có. Nút cập nhật quá hạn gọi /billing/invoices/refresh-overdue; Xuất CSV gọi /billing/invoices/report?from=&to=. Restaurant manager chỉ thấy tổ chức mình và không thấy action kế toán. Tiền luôn format VND nhưng payload giữ số.
```

## Prompt 16 — Quản lý thùng `/portal/assets`

```text
Tạo trang /portal/assets trong PortalShell. Overview inventory theo status/condition/location từ GET /assets/inventory; table searchable bằng asset code; bộ lọc status, condition, organization. Detail drawer có QR, vị trí hiện tại, movement timeline, cleaning records và incidents. Action Báo mất/Báo hỏng mở modal type, fee, description và gọi POST /assets/{id}/incidents. Giữ các action cấp/giao/thu hồi/vệ sinh hiện có theo role và trạng thái. Có chế độ kiểm kê: tick nhiều thùng, so expected/observed, hiển thị discrepancy nhưng không tạo endpoint giả. Danger states rõ, fee VND, mọi mutation refetch inventory và detail.
```

## Prompt 17 — Thành viên tổ chức `/portal/members`

```text
Tạo trang /portal/members trong PortalShell cho RESTAURANT_MANAGER và SUPPLIER_MANAGER. Table gồm tên, email, điện thoại, vai trò, trạng thái, joined date. Invite drawer nhập email và một role hợp lệ theo loại tổ chức; gọi POST /organizations/{org}/invitations. Trong prototype hiển thị copy invitation link vì chưa có email provider. Edit roles gọi PUT /organizations/{org}/members/{member}/roles; disable gọi DELETE và có confirm. Không cho manager tự disable chính mình; UI vẫn xử lý conflict từ server. Có pending invitations section, empty/loading/error, audit hint. OrganizationSwitcher đổi org thì refetch và reset selection.
```

## Prompt 18 — Thông báo `/portal/notifications`

```text
Tạo NotificationBell dùng chung trong PortalHeader và trang /portal/notifications. Bell hiển thị unread count, popover 5 mục mới nhất và link Xem tất cả. Trang có tabs Tất cả/Chưa đọc, filter loại, nhóm theo Hôm nay/Hôm qua/Cũ hơn. Click item điều hướng entity route theo related_entity_type/id và đánh dấu đã đọc. Có Mark all read gọi /notifications/read-all và từng item gọi /notifications/{id}/read. Dùng infinite-looking pagination mock nhưng API limit tối đa 200. Empty state thân thiện, timestamp relative kèm tooltip absolute Asia/Ho_Chi_Minh.
```

## Prompt 19 — Phân tích `/portal/analytics`

```text
Tạo dashboard phân tích /portal/analytics trong PortalShell. Date range tối đa 366 ngày, preset 7/30/90 ngày. Dữ liệu GET /analytics/kpis. Sections: orders funnel; delivery on-time/failed; quality acceptance rate; claim resolution time; receivables overdue. Dùng chart accessible có legend, tooltip, table fallback và không vẽ số liệu giả nếu API trả null. Role chỉ thấy KPI liên quan. Card click mở module đích với filter tương ứng. Có compare previous period trong mock prototype, loading skeleton, empty state và nút retry.
```

## Prompt 20 — Quản trị và bảo mật `/portal/admin/security`

```text
Tạo trang /portal/admin/security trong PortalShell chỉ cho SYSTEM_ADMIN. Tabs Audit log, Lịch sử đăng nhập, Cảnh báo. Audit table filter entityType/entityId/action/actor/date; detail drawer render old_data/new_data dạng key-value diff, không raw JSON khó đọc. Login history có success/failure, email, IP, user agent, time và cảnh báo nhiều lần thất bại. Dùng GET /admin/audit-logs và /admin/login-history với limit. Không hiển thị token, password hash, API secret. Tạo export-current-view chỉ ở client cho prototype. Có 403 route khi role khác mở URL trực tiếp.
```

## Prompt 21 — Kiểm tra và nối prototype toàn hệ thống

```text
Rà soát toàn bộ project FreshLink vừa sinh và hoàn thiện prototype end-to-end. Không đổi design system hay tạo shell mới. Đảm bảo tất cả routes trong Prompt 00 tồn tại, PublicHeader/PublicFooter và PortalShell chỉ có một nguồn component, menu active/breadcrumb/back-forward đúng. Seed một workflow liên kết bằng ID ổn định: restaurant tạo đơn -> purchaser gửi duyệt -> manager duyệt -> operations tạo supply request -> supplier chấp nhận và tạo lô -> quality kiểm/cách ly/reinspect -> operations tạo và reorder trip -> driver arrive/deliver -> restaurant nhận và rate supplier -> accountant phát hành invoice/payment -> CSKH xử lý claim. Mutation ở một trang phải phản ánh khi sang trang liên quan.

Chạy typecheck/build và sửa mọi lỗi. Kiểm tra ở 375px, 768px, 1440px; không overflow ngang ngoài data table có scroll container. Không có nút chết, link '#', dữ liệu lorem ipsum, lỗi Unicode tiếng Việt, duplicate header/footer, duplicated status mapping hay component style xung đột. Thêm README ngắn: npm install, npm run dev, npm run build; cách bật mock mode và cách đặt VITE_API_URL để nối backend thật.
```
