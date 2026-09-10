import { useRef, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Typography } from 'antd'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadEvidence, uploadEvidence } from '../api/http'

export type Row = Record<string, unknown>
export type Option = { value: string | number; label: string }
export type Field = { name: string; label: string; type?: 'number' | 'date' | 'time' | 'text' | 'password' | 'file' | 'textarea' | 'select' | 'multiple'; options?: Option[]; initial?: unknown; required?: boolean; min?: number; max?: number }
function EvidenceInput({ value, onChange }: { value?: number; onChange?: (value: number) => void }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  return <><Input type="file" accept="image/png,image/jpeg,application/pdf" disabled={busy} onChange={async e => {
    const file = e.target.files?.[0]; if (!file) return
    setBusy(true); setError(''); try { const result = await uploadEvidence(file); onChange?.(result.id) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }} />{busy && <span>Đang tải tệp…</span>}{value && <span>Đã lưu bằng chứng #{value}</span>}{error && <Alert type="error" message={error} />}</>
}
export function EvidenceLink({ id }: { id: number }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <Space direction="vertical"><Button size="small" loading={busy} onClick={async () => {
    setBusy(true); setError(''); try { await downloadEvidence(id) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }}>Tải tệp</Button>{error && <Typography.Text type="danger">{error}</Typography.Text>}</Space>
}
export function useRows(path: string, enabled = true) {
  return useQuery({ queryKey: [path], queryFn: () => api<Row[]>(path), enabled })
}
export function options(rows: Row[] | undefined, id: string, label: string): Option[] {
  return rows?.map(r => ({ value: r[id] as number | string, label: String(r[label]) })) ?? []
}
export function DataTable({ path, columns, rowKey, actions }: { path: string; columns: [string, string][]; rowKey: string; actions?: (row: Row) => ReactNode }) {
  const query = useRows(path)
  return <>{query.error && <Alert type="error" message={query.error.message} action={<Button onClick={() => void query.refetch()}>Thử lại</Button>} />}
    <Table<Row> rowKey={rowKey} loading={query.isPending} dataSource={query.data ?? []} scroll={{ x: 'max-content' }} pagination={{ pageSize: 10 }}
      columns={[...columns.map(([key, title]) => ({ key, title, dataIndex: key, render: (value: unknown) => value == null ? '—' : String(value) })), ...(actions ? [{ key: 'actions', title: 'Thao tác', render: (_: unknown, row: Row) => actions(row) }] : [])]} />
  </>
}
export function ActionForm({ title, fields, path, transform, onDone }: { title: string; fields: Field[]; path: string | ((values: Row) => string); transform?: (values: Row) => unknown; onDone?: (result: unknown) => void }) {
  const [form] = Form.useForm(); const client = useQueryClient()
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState(false)
  const request = useRef({ body: '', key: crypto.randomUUID() })
  return <Card size="small" title={title} className="action-card">
    {error && <Alert type="error" message={error} showIcon />}{success && <Alert type="success" message="Đã lưu thành công" showIcon closable />}
    <Form form={form} layout="vertical" initialValues={Object.fromEntries(fields.map(f => [f.name, f.initial]))} onFinish={async (values: Row) => {
      setBusy(true); setError(''); setSuccess(false)
      const url = typeof path === 'function' ? path(values) : path
      const body = transform ? transform(values) : values
      const fingerprint = url + JSON.stringify(body)
      if (request.current.body !== fingerprint) request.current = { body: fingerprint, key: crypto.randomUUID() }
      try { const result = await api(url, 'POST', body, request.current.key); setSuccess(true); await client.invalidateQueries(); onDone?.(result) }
      catch (e) { setError((e as Error).message) } finally { setBusy(false) }
    }}>
      <div className="form-grid">{fields.map(f => <Form.Item key={f.name} name={f.name} label={f.label} rules={[{ required: f.required !== false, message: `Vui lòng nhập ${f.label.toLowerCase()}` }]}>
        {f.type === 'file' ? <EvidenceInput /> : f.type === 'select' || f.type === 'multiple' ? <Select showSearch optionFilterProp="label" mode={f.type === 'multiple' ? 'multiple' : undefined} options={f.options ?? []} /> : f.type === 'number' ? <InputNumber min={f.min ?? 0} max={f.max} style={{ width: '100%' }} /> : f.type === 'textarea' ? <Input.TextArea rows={3} maxLength={2000} /> : <Input type={f.type ?? 'text'} />}
      </Form.Item>)}</div><Button type="primary" htmlType="submit" loading={busy}>Lưu {title.toLowerCase()}</Button>
    </Form>
  </Card>
}
export function QrButton({ type, id }: { type: string; id: unknown }) {
  const [label, setLabel] = useState<{ image: string; url: string } | null>(null); const [error, setError] = useState('')
  return <Space direction="vertical"><Button onClick={async () => { try { setLabel(await api(`/qr/${type}/${id}`, 'POST')); setError('') } catch (e) { setError((e as Error).message) } }}>Xem / in QR</Button>
    {error && <Typography.Text type="danger">{error}</Typography.Text>}{label && <div className="qr-label"><img width={180} height={180} src={label.image} alt="Mã QR truy xuất" /><p><a href={label.url} target="_blank" rel="noreferrer">Mở truy xuất</a></p><Button onClick={() => window.print()}>In nhãn</Button></div>}
  </Space>
}
export function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 2); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) }
