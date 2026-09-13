import { useEffect, useRef, useState } from 'react'
import { Modal, Tabs, Input, Button, Alert, message, Space } from 'antd'
import { useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'

interface WebQrScannerModalProps {
  open: boolean
  onClose: () => void
}

export function WebQrScannerModal({ open, onClose }: WebQrScannerModalProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'manual'>('camera')
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [manualCode, setManualCode] = useState('')
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const scanningRef = useRef<boolean>(false)

  // Extract clean code from decoded URL or raw string
  const extractCode = (data: string): string => {
    const trimmed = data.trim()
    if (trimmed.includes('/trace/')) {
      const parts = trimmed.split('/trace/')
      const after = parts[1] || ''
      return after.split('?')[0].split('#')[0].trim()
    }
    return trimmed
  }

  const handleSuccessScan = (rawText: string) => {
    const cleanCode = extractCode(rawText)
    if (!cleanCode) {
      message.warning('Không nhận diện được mã hợp lệ')
      return
    }
    stopCamera()
    message.success(`Đã quét được mã: ${cleanCode}`)
    onClose()
    navigate(`/trace/${cleanCode}`)
  }

  // Camera Management
  const startCamera = async () => {
    setCameraError(null)
    stopCamera()

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Trình duyệt không hỗ trợ truy cập Camera trực tiếp. Vui lòng dùng tính năng tải ảnh hoặc nhập mã.')
        return
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      })

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        scanningRef.current = true
        scanTick()
      }
    } catch (err) {
      console.error('Camera access error:', err)
      const errorMsg = (err as Error).name === 'NotAllowedError'
        ? 'Bạn chưa cấp quyền truy cập Camera cho trang web. Vui lòng kiểm tra quyền trên thanh địa chỉ trình duyệt.'
        : 'Không thể mở Camera trên thiết bị. Bạn có thể tải ảnh tem QR hoặc nhập mã lô thủ công.'
      setCameraError(errorMsg)
    }
  }

  const stopCamera = () => {
    scanningRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const scanTick = () => {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        })

        if (qrCode && qrCode.data) {
          scanningRef.current = false
          handleSuccessScan(qrCode.data)
          return
        }
      }
    }

    if (scanningRef.current) {
      animationFrameRef.current = requestAnimationFrame(scanTick)
    }
  }

  // Handle open / tab changes
  useEffect(() => {
    if (open && activeTab === 'camera') {
      void startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab, facingMode])

  // Handle image file upload
  const handleImageFile = (file: File) => {
    setIsProcessingUpload(true)
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      if (!result) {
        setIsProcessingUpload(false)
        return
      }
      const img = new Image()
      img.onload = () => {
        const offscreenCanvas = document.createElement('canvas')
        offscreenCanvas.width = img.naturalWidth || img.width
        offscreenCanvas.height = img.naturalHeight || img.height
        const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          setIsProcessingUpload(false)
          message.error('Không thể khởi tạo bộ xử lý đồ họa ảnh')
          return
        }
        ctx.drawImage(img, 0, 0)
        const imgData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height)
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth'
        })

        setIsProcessingUpload(false)
        if (code && code.data) {
          handleSuccessScan(code.data)
        } else {
          message.warning('Không tìm thấy mã QR trong ảnh vừa chọn. Vui lòng chọn ảnh chụp tem QR rõ nét và đủ sáng.')
        }
      }
      img.onerror = () => {
        setIsProcessingUpload(false)
        message.error('Lỗi khi đọc tệp ảnh')
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  }

  const handleManualSubmit = () => {
    if (!manualCode.trim()) {
      message.warning('Vui lòng nhập mã lô hàng hoặc mã QR')
      return
    }
    handleSuccessScan(manualCode)
  }

  return (
    <Modal
      open={open}
      onCancel={() => {
        stopCamera()
        onClose()
      }}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: '#176b45' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>qr_code_scanner</span>
          <span>Quét Mã QR Truy Xuất Nguồn Gốc VietGAP</span>
        </div>
      }
      destroyOnClose
      width={520}
      centered
    >
      <Tabs
        activeKey={activeTab}
        onChange={k => setActiveTab(k as 'camera' | 'upload' | 'manual')}
        centered
        items={[
          {
            key: 'camera',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                Camera trực tiếp
              </span>
            ),
            children: (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                {cameraError ? (
                  <div style={{ padding: 16 }}>
                    <Alert
                      type="warning"
                      showIcon
                      message="Không thể bật Camera"
                      description={cameraError}
                      style={{ marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
                    />
                    <Space>
                      <Button onClick={startCamera}>Thử lại</Button>
                      <Button type="primary" onClick={() => setActiveTab('upload')}>Chuyển sang tải ảnh</Button>
                    </Space>
                  </div>
                ) : (
                  <div>
                    {/* Viewfinder container */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 360,
                        aspectRatio: '1/1',
                        margin: '0 auto',
                        overflow: 'hidden',
                        borderRadius: 16,
                        backgroundColor: '#000000',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                      }}
                    >
                      <video
                        ref={videoRef}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />

                      {/* Optical Viewfinder Overlay Frame */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '15%',
                          left: '15%',
                          right: '15%',
                          bottom: '15%',
                          border: '2px solid rgba(255,255,255,0.7)',
                          borderRadius: 12,
                          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                          pointerEvents: 'none'
                        }}
                      >
                        {/* 4 Green Corner Marks */}
                        <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: 6 }} />
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: 6 }} />
                        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: 6 }} />
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: 6 }} />

                        {/* Animated Laser Scanning Line */}
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            height: 3,
                            background: 'linear-gradient(90deg, transparent 0%, #10b981 50%, transparent 100%)',
                            boxShadow: '0 0 8px #10b981',
                            animation: 'scanner-laser 2s infinite ease-in-out'
                          }}
                        />
                      </div>
                    </div>

                    <p style={{ marginTop: 12, marginBottom: 12, fontSize: 13, color: '#64748b' }}>
                      Hướng camera vào mã QR in trên thùng SmartCrate hoặc tem VietGAP
                    </p>

                    <Button
                      size="small"
                      icon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>cameraswitch</span>}
                      onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
                    >
                      Đổi camera ({facingMode === 'environment' ? 'Sau' : 'Trước'})
                    </Button>
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'upload',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>
                Tải ảnh tem QR
              </span>
            ),
            children: (
              <div style={{ padding: '20px 10px', textAlign: 'center' }}>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px dashed #10b981',
                    borderRadius: 14,
                    padding: '36px 20px',
                    backgroundColor: '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#10b981', marginBottom: 10 }}>
                    add_photo_alternate
                  </span>
                  <strong style={{ fontSize: 15, color: '#065f46' }}>
                    {isProcessingUpload ? 'Đang phân tích hình ảnh…' : 'Bấm để chọn ảnh hoặc kéo thả ảnh tem QR'}
                  </strong>
                  <span style={{ fontSize: 12.5, color: '#047857', marginTop: 4 }}>
                    Hỗ trợ định dạng PNG, JPG, JPEG, WEBP
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={isProcessingUpload}
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleImageFile(file)
                    }}
                  />
                </label>
              </div>
            )
          },
          {
            key: 'manual',
            label: (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>keyboard</span>
                Nhập mã thủ công
              </span>
            ),
            children: (
              <div style={{ padding: '20px 10px' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13.5, color: '#475569' }}>
                  Nếu camera hoặc hình ảnh bị mờ, bạn có thể gõ trực tiếp <strong>Mã lô hàng</strong> (VD: <code>LO-2026...</code>) hoặc mã định danh QR:
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    placeholder="Ví dụ: LO-20260913-001 hoặc mã UUID..."
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value)}
                    onPressEnter={handleManualSubmit}
                    size="large"
                    allowClear
                  />
                  <Button type="primary" size="large" onClick={handleManualSubmit} style={{ background: '#176b45' }}>
                    Tra cứu
                  </Button>
                </div>
              </div>
            )
          }
        ]}
      />

      <style>{`
        @keyframes scanner-laser {
          0% { top: 0%; opacity: 0.8; }
          50% { top: 96%; opacity: 1; }
          100% { top: 0%; opacity: 0.8; }
        }
      `}</style>
    </Modal>
  )
}
