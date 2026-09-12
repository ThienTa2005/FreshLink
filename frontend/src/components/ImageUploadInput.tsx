import React, { useState } from 'react'
import { Alert, Button, Input, Space, Spin, Tag } from 'antd'
import { uploadEvidence } from '../api/http'
import { ProductImage } from './ProductImage'

export function ImageUploadInput({
  value,
  onChange,
  onFileIdChange,
}: {
  value?: string
  onChange?: (url: string) => void
  onFileIdChange?: (fileId: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(value)
  const [inputUrl, setInputUrl] = useState(false)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)

    // Local object URL for instantaneous preview
    const localBlob = URL.createObjectURL(file)
    setPreviewUrl(localBlob)

    try {
      // Upload with isPublic = true to push to Cloudinary
      const res = await uploadEvidence(file, true)
      const finalUrl = res.url || `/api/public/media/${res.id}`
      setPreviewUrl(finalUrl)
      onChange?.(finalUrl)
      if (res.id && onFileIdChange) {
        onFileIdChange(res.id)
      }
    } catch (err) {
      setError((err as Error).message || 'Tải ảnh lên Cloudinary thất bại')
      setPreviewUrl(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="image-upload-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <ProductImage src={previewUrl} alt="Xem trước nông sản" size={72} showBadge={!previewUrl} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <Space wrap size="small">
            <label
              className="button button-small"
              style={{
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#176b45',
                color: '#ffffff',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 650,
                opacity: busy ? 0.7 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span>
              {busy ? 'Đang đẩy sang Cloudinary...' : 'Tải ảnh lên Cloudinary'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                disabled={busy}
                onChange={e => void handleFileChange(e)}
                style={{ display: 'none' }}
              />
            </label>

            <Button
              size="small"
              type="dashed"
              onClick={() => setInputUrl(!inputUrl)}
            >
              {inputUrl ? 'Ẩn nhập URL' : 'Nhập URL trực tiếp'}
            </Button>

            {previewUrl && (
              <Button
                size="small"
                danger
                onClick={() => {
                  setPreviewUrl(undefined)
                  onChange?.('')
                }}
              >
                Xóa ảnh
              </Button>
            )}
          </Space>

          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag color="green" style={{ fontSize: 11, borderRadius: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle', marginRight: 3 }}>verified</span>
              Cloudinary CDN Tự động
            </Tag>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              PNG, JPG, WEBP tối đa 10 MB
            </span>
          </div>
        </div>
      </div>

      {busy && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#176b45' }}>
          <Spin size="small" />
          <span>Đang tối ưu và tải ảnh lên Cloudinary...</span>
        </div>
      )}

      {inputUrl && (
        <div style={{ marginTop: 4 }}>
          <Input
            placeholder="Dán link ảnh Cloudinary hoặc web (https://...)"
            value={value}
            onChange={e => {
              const u = e.target.value
              setPreviewUrl(u)
              onChange?.(u)
            }}
          />
        </div>
      )}

      {error && <Alert type="error" message={error} showIcon style={{ marginTop: 4 }} />}
    </div>
  )
}
