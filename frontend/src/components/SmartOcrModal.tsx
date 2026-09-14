import { useState, useRef, useEffect, useCallback } from 'react'
import { Modal, Tabs, Button, Input, Table, Tag, Tooltip, Alert, Spin, Space, Badge } from 'antd'
import {
  scanSmartOcrFile,
  scanSmartOcrText,
  getSmartOcrSamples,
  type SmartOcrResult,
  type MatchedItem,
  type SmartOcrSample
} from '../api/http'
import { display } from './permissions'

interface SmartOcrModalProps {
  open: boolean
  onClose: () => void
  onAddToCart: (items: { skuId: number; quantity: number }[]) => void
  currentDate?: string
}

export function SmartOcrModal({
  open,
  onClose,
  onAddToCart,
  currentDate
}: SmartOcrModalProps) {
  const [activeTab, setActiveTab] = useState<'image' | 'text'>('image')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SmartOcrResult | null>(null)
  const [selectedSkuIds, setSelectedSkuIds] = useState<number[]>([])
  const [editedQuantities, setEditedQuantities] = useState<Record<number, number>>({})
  const [samples, setSamples] = useState<SmartOcrSample[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch quick demo samples
  useEffect(() => {
    if (open && samples.length === 0) {
      getSmartOcrSamples()
        .then(setSamples)
        .catch(() => {
          // Fallback if API fails
          setSamples([
            {
              title: '🍲 Nhà hàng Lẩu nấm & Rau rừng',
              tag: 'Bếp Trưởng Lẩu',
              content: '5kg cải thảo\n10 bó rau muống\n3kg nấm đùi gà\n2kg cà chua bi\n4kg bắp mỹ'
            },
            {
              title: '🥤 Quán Sinh tố & Nước ép (Săn nông sản xấu mã -30%)',
              tag: 'Rescue Juice Bar',
              content: '15kg dưa hấu giải cứu\n10kg ổi ruột hồng xước vỏ\n8kg cam sành loại 2\n5kg chanh dây méo mó'
            },
            {
              title: '🍜 Quán Phở bò & Cơm văn phòng',
              tag: 'Bếp Trung Tâm',
              content: 'Hành lá: 3kg\nNgò gai - 1kg\nGiá đỗ: 8kg\nChanh tươi - 4kg\nỚt sừng: 500g'
            }
          ])
        })
    }
  }, [open, samples.length])

  // Handle clipboard paste for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!open || activeTab !== 'image') return
    const items = e.clipboardData?.items
    if (!items) return

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile()
        if (blob) {
          setSelectedFile(blob)
          const url = URL.createObjectURL(blob)
          setPreviewUrl(url)
          setError(null)
          break
        }
      }
    }
  }, [open, activeTab])

  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handlePaste])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setError(null)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setError(null)
    }
  }

  const executeOcr = async () => {
    setError(null)
    setLoading(true)
    setResult(null)

    try {
      let res: SmartOcrResult
      if (activeTab === 'image') {
        if (!selectedFile) {
          throw new Error('Vui lòng chọn hoặc chụp ảnh ghi chú đầu bếp trước khi quét.')
        }
        res = await scanSmartOcrFile(selectedFile, currentDate)
      } else {
        if (!textInput.trim()) {
          throw new Error('Vui lòng nhập nội dung ghi chú nguyên liệu cần quét.')
        }
        res = await scanSmartOcrText(textInput, currentDate)
      }

      setResult(res)
      // By default, select all matched items
      setSelectedSkuIds(res.matchedItems.map(item => item.skuId))
      const initQtys: Record<number, number> = {}
      for (const item of res.matchedItems) {
        initQtys[item.skuId] = item.quantity
      }
      setEditedQuantities(initQtys)
    } catch (err) {
      setError((err as Error).message || 'Có lỗi xảy ra khi nhận diện thông minh.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuantityChange = (skuId: number, newQty: number) => {
    setEditedQuantities(prev => ({
      ...prev,
      [skuId]: Math.max(0, newQty)
    }))
  }

  const handleConfirmAddToCart = () => {
    if (!result) return
    const itemsToAdd = result.matchedItems
      .filter(item => selectedSkuIds.includes(item.skuId))
      .map(item => ({
        skuId: item.skuId,
        quantity: editedQuantities[item.skuId] ?? item.quantity
      }))
      .filter(item => item.quantity > 0)

    if (itemsToAdd.length === 0) {
      setError('Vui lòng chọn ít nhất 1 mặt hàng có số lượng lớn hơn 0.')
      return
    }

    onAddToCart(itemsToAdd)
    onClose()
  }

  const resetState = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setTextInput('')
    setResult(null)
    setError(null)
    setSelectedSkuIds([])
    setEditedQuantities({})
  }

  const calculateSelectedTotal = () => {
    if (!result) return 0
    return result.matchedItems
      .filter(item => selectedSkuIds.includes(item.skuId))
      .reduce((sum, item) => {
        const qty = editedQuantities[item.skuId] ?? item.quantity
        return sum + qty * item.unitPrice
      }, 0)
  }

  return (
    <Modal
      open={open}
      onCancel={() => {
        resetState()
        onClose()
      }}
      width={900}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>📸</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>
              AI Gemini OCR - Quét Ghi Chú & Hóa Đơn Đầu Bếp
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              Tự động nhận diện chữ viết tay, khớp chính xác mã hàng FreshLink và săn nông sản xấu mã -30%
            </div>
          </div>
        </div>
      }
      footer={
        result && result.matchedItems.length > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                Đã chọn <strong>{selectedSkuIds.length}/{result.matchedItems.length}</strong> mặt hàng
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a' }}>
                Ước tính: {display(calculateSelectedTotal(), 'amount')}
              </div>
            </div>
            <Space>
              <Button onClick={() => setResult(null)}>Quét lại</Button>
              <Button
                type="primary"
                onClick={handleConfirmAddToCart}
                disabled={selectedSkuIds.length === 0}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  height: 40,
                  fontWeight: 600,
                  fontSize: 14,
                  borderRadius: 8
                }}
              >
                🛒 Thêm {selectedSkuIds.length} món vào giỏ hàng
              </Button>
            </Space>
          </div>
        ) : (
          <Space>
            <Button
              onClick={() => {
                resetState()
                onClose()
              }}
            >
              Đóng
            </Button>
            <Button
              type="primary"
              onClick={executeOcr}
              loading={loading}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                fontWeight: 600,
                borderRadius: 8
              }}
            >
              ✨ Bắt đầu Nhận diện AI
            </Button>
          </Space>
        )
      }
    >
      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {!result ? (
        <div>
          <Tabs
            activeKey={activeTab}
            onChange={k => setActiveTab(k as 'image' | 'text')}
            items={[
              {
                key: 'image',
                label: '📷 Tải ảnh / Chụp ảnh ghi chú',
                children: (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      accept="image/*"
                      onChange={handleFileChange}
                    />

                    {!previewUrl ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={handleDrop}
                        style={{
                          border: '2px dashed #94a3b8',
                          borderRadius: 14,
                          padding: '36px 20px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          background: '#f8fafc',
                          transition: 'all 0.2s ease',
                          marginBottom: 16
                        }}
                      >
                        <div style={{ fontSize: 44, marginBottom: 8 }}>📋 ➔ 🤖</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                          Nhấp để tải ảnh lên hoặc kéo thả ảnh vào đây
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>
                          Hỗ trợ ảnh chụp sổ tay viết tay, hóa đơn cũ, chụp màn hình Zalo... (Có thể bấm <strong>Ctrl + V</strong> để dán trực tiếp)
                        </div>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <div
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            borderRadius: 12,
                            overflow: 'hidden',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt="Ghi chú đầu bếp"
                            style={{
                              maxHeight: 280,
                              maxWidth: '100%',
                              objectFit: 'contain',
                              display: 'block'
                            }}
                          />
                          {loading && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(15, 23, 42, 0.65)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff'
                              }}
                            >
                              <Spin size="large" />
                              <div style={{ marginTop: 12, fontWeight: 600, fontSize: 14 }}>
                                AI Gemini đang đọc chữ viết tay...
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <Button size="small" onClick={() => fileInputRef.current?.click()}>
                            Đổi ảnh khác
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              },
              {
                key: 'text',
                label: '✍️ Ghi chú nhanh (Copy/Paste)',
                children: (
                  <div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
                      Nhập danh sách nguyên liệu hoặc copy tin nhắn Zalo của bếp trưởng (VD: <em>5kg cải thảo, 10 bó rau muống, 15kg dưa hấu giải cứu</em>):
                    </div>
                    <Input.TextArea
                      rows={6}
                      value={textInput}
                      onChange={e => setTextInput(e.target.value)}
                      placeholder="VD:&#10;5kg cải thảo&#10;10 bó rau muống&#10;3kg nấm đùi gà&#10;15kg dưa hấu giải cứu (-35%)"
                      style={{ fontSize: 14, fontFamily: 'monospace', borderRadius: 8 }}
                    />
                  </div>
                )
              }
            ]}
          />

          {/* Quick Demo Sample Prompts */}
          <div style={{ marginTop: 16, background: '#f1f5f9', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>💡 Thử nhanh với mẫu thực tế:</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {samples.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveTab('text')
                    setTextInput(sample.content)
                  }}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#16a34a')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{sample.title}</span>
                    <Tag color="cyan" style={{ fontSize: 10.5, margin: 0 }}>{sample.tag}</Tag>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, whiteSpace: 'pre-line', maxHeight: 42, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {sample.content}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Recognition Results */
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>
                🎉 {result.notes}
              </div>
              <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
                Đã nhận diện <strong>{result.totalMatched}</strong> sản phẩm khả dụng trong kho FreshLink. Bạn có thể điều chỉnh số lượng trước khi thêm vào giỏ.
              </div>
            </div>
            <Tag color={result.scanSource === 'IMAGE_UPLOAD' ? 'purple' : 'blue'} style={{ fontWeight: 600 }}>
              {result.scanSource === 'IMAGE_UPLOAD' ? 'Gemini 2.5 Flash Vision' : 'AI Text Parser'}
            </Tag>
          </div>

          <Table<MatchedItem>
            rowKey="skuId"
            dataSource={result.matchedItems}
            pagination={false}
            size="small"
            rowSelection={{
              selectedRowKeys: selectedSkuIds,
              onChange: keys => setSelectedSkuIds(keys as number[])
            }}
            columns={[
              {
                title: 'Ghi chú gốc',
                width: 140,
                render: (_, item) => (
                  <div>
                    <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
                      "{item.originalText || item.skuName}"
                    </span>
                    <div style={{ marginTop: 2 }}>
                      <Tag
                        color={
                          item.matchStatus === 'EXACT'
                            ? 'success'
                            : item.matchStatus === 'HIGH'
                            ? 'processing'
                            : 'warning'
                        }
                        style={{ fontSize: 10.5, padding: '0 4px' }}
                      >
                        {item.matchStatus === 'EXACT'
                          ? '✓ Khớp 100%'
                          : item.matchStatus === 'HIGH'
                          ? 'Gần đúng'
                          : 'Tham khảo'}
                      </Tag>
                    </div>
                  </div>
                )
              },
              {
                title: 'Mặt hàng FreshLink',
                render: (_, item) => (
                  <div>
                    <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {item.skuName}
                      {item.gradeType === 'GRADE_B_RESCUE' && (
                        <Tooltip title={item.rescueReason || 'Nông sản xấu mã nhưng tươi ngon 100%, giảm giá sốc'}>
                          <Tag color="orange" style={{ fontWeight: 700, borderRadius: 6, cursor: 'pointer' }}>
                            🥕 Xấu mã -{item.discountPercent ?? 30}%
                          </Tag>
                        </Tooltip>
                      )}
                    </div>
                    <small style={{ color: '#64748b' }}>
                      {item.packDescription} · {item.baseUnit}
                    </small>
                  </div>
                )
              },
              {
                title: 'Đơn giá',
                width: 110,
                render: (_, item) => (
                  <div>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      {display(item.unitPrice, 'price')}
                    </span>
                    {item.gradeType === 'GRADE_B_RESCUE' && (
                      <div style={{ fontSize: 11, color: '#ea580c', fontWeight: 600 }}>
                        (Đã giảm {item.discountPercent ?? 30}%)
                      </div>
                    )}
                  </div>
                )
              },
              {
                title: 'Số lượng đặt',
                width: 130,
                render: (_, item) => {
                  const qty = editedQuantities[item.skuId] ?? item.quantity
                  return (
                    <Input
                      type="number"
                      size="small"
                      min={0}
                      step={item.packSize || 1}
                      value={qty}
                      onChange={e => handleQuantityChange(item.skuId, parseFloat(e.target.value) || 0)}
                      style={{ width: 90, textAlign: 'center', fontWeight: 600 }}
                    />
                  )
                }
              },
              {
                title: 'Thành tiền',
                width: 120,
                render: (_, item) => {
                  const qty = editedQuantities[item.skuId] ?? item.quantity
                  const lineTotal = qty * item.unitPrice
                  return (
                    <span style={{ fontWeight: 700, color: '#15803d' }}>
                      {display(lineTotal, 'amount')}
                    </span>
                  )
                }
              }
            ]}
          />

          {/* Unmatched Items Alert */}
          {result.unmatchedItems && result.unmatchedItems.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Alert
                type="warning"
                message={`Có ${result.unmatchedItems.length} mặt hàng chưa có trong kho FreshLink:`}
                description={
                  <div style={{ marginTop: 6 }}>
                    {result.unmatchedItems.map((u, i) => (
                      <span key={i} style={{ display: 'inline-block', marginRight: 8, marginBottom: 4 }}>
                        <Badge status="default" text={`${u.detectedName} (${u.quantity} ${u.unit})`} />
                      </span>
                    ))}
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      FreshLink sẽ ghi nhận để mở rộng thêm nguồn cung HTX phù hợp cho nhà hàng của bạn.
                    </div>
                  </div>
                }
                showIcon
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
