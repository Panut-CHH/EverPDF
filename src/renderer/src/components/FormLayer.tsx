import { useDocStore } from '@/store/documentStore'
import type { FormField } from '@/lib/forms'

interface Size {
  width: number
  height: number
}

/**
 * ชั้นกรอกฟอร์ม (AcroForm) ซ้อนบนหน้า
 * เปิดใช้เฉพาะโหมด select เพื่อไม่ชนกับเครื่องมือวาด
 */
export default function FormLayer({
  originalIndex,
  size
}: {
  originalIndex: number
  size: Size
}): JSX.Element | null {
  const fields = useDocStore((s) => s.formFields.filter((f) => f.pageIndex === originalIndex))
  const tool = useDocStore((s) => s.tool)

  if (tool !== 'select' || fields.length === 0) return null

  return (
    <div className="form-layer" style={{ width: size.width, height: size.height }}>
      {fields.map((f, i) => (
        <FieldInput key={`${f.name}-${i}`} field={f} />
      ))}
    </div>
  )
}

function FieldInput({ field }: { field: FormField }): JSX.Element {
  const setFormValue = useDocStore((s) => s.setFormValue)
  const style: React.CSSProperties = {
    left: `${field.x * 100}%`,
    top: `${field.y * 100}%`,
    width: `${field.w * 100}%`,
    height: `${field.h * 100}%`
  }

  if (field.type === 'checkbox' || field.type === 'radio') {
    return (
      <input
        className="form-field form-check"
        style={style}
        type={field.type === 'radio' ? 'radio' : 'checkbox'}
        checked={!!field.value}
        disabled={field.readOnly}
        onChange={(e) =>
          setFormValue(field.name, field.type === 'radio' ? field.exportValue ?? 'On' : e.target.checked)
        }
      />
    )
  }

  if (field.type === 'dropdown') {
    return (
      <select
        className="form-field"
        style={style}
        value={String(field.value ?? '')}
        disabled={field.readOnly}
        onChange={(e) => setFormValue(field.name, e.target.value)}
      >
        <option value="" />
        {field.options?.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    )
  }

  // text
  return field.multiline ? (
    <textarea
      className="form-field"
      style={style}
      value={String(field.value ?? '')}
      readOnly={field.readOnly}
      onChange={(e) => setFormValue(field.name, e.target.value)}
    />
  ) : (
    <input
      className="form-field"
      style={style}
      type="text"
      value={String(field.value ?? '')}
      readOnly={field.readOnly}
      onChange={(e) => setFormValue(field.name, e.target.value)}
    />
  )
}
