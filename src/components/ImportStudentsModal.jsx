import { useState } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CATEGORIES, DAY_NAMES_FULL } from '../lib/helpers'
import { CloseIcon, PlusIcon } from './Icons'

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const HEADER_ALIASES = {
  name: ['nombre', 'name', 'alumno', 'alumna'],
  phone: ['telefono', 'whatsapp', 'celular', 'phone', 'contacto', 'numero'],
  gender: ['genero', 'sexo', 'gender'],
  category: ['categoria', 'category'],
  category_level: ['nivel', 'level'],
  group_size: ['grupo', 'tamano de grupo', 'group_size', 'tipo', 'tipo de clase'],
  day_of_week: ['dia', 'dia habitual', 'day'],
  time_slot: ['horario', 'hora', 'time', 'horario habitual'],
  notes: ['notas', 'notes', 'observaciones'],
}

function detectHeaderMap(headers) {
  const map = {}
  headers.forEach((h) => {
    const n = norm(h)
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (map[field]) continue
      if (aliases.some((a) => n === a || n.includes(a))) map[field] = h
    }
  })
  return map
}

function mapGender(v) {
  const n = norm(v)
  if (!n) return null
  if (['damas', 'dama', 'f', 'femenino', 'mujer'].includes(n)) return 'Damas'
  if (['caballeros', 'caballero', 'm', 'masculino', 'hombre'].includes(n)) return 'Caballeros'
  return null
}

function mapCategory(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return { category: null, level: null }
  let level = null
  let base = raw
  if (/[+-]$/.test(raw)) {
    level = raw.slice(-1)
    base = raw.slice(0, -1).trim()
  }
  const n = norm(base)
  const found = CATEGORIES.find((c) => norm(c) === n)
  return { category: found || null, level: found ? level : null }
}

function mapGroupSize(v) {
  const n = norm(v)
  if (!n) return 'individual'
  if (n.includes('duo') || n.includes('dos') || n.includes('pareja')) return 'duo'
  if (n.includes('trio') || n.includes('tres')) return 'trio'
  if (n.includes('4') || n.includes('cuatro')) return 'grupo4'
  if (n.includes('mensual') || n.includes('mes')) return 'mensual'
  if (n.includes('individual') || n.includes('uno')) return 'individual'
  return 'individual'
}

function mapDay(v) {
  if (v === '' || v == null) return null
  const n = norm(v)
  const byName = DAY_NAMES_FULL.findIndex((d) => norm(d) === n || norm(d).startsWith(n))
  if (byName >= 0) return byName
  const num = Number(v)
  if (!isNaN(num) && num >= 0 && num <= 6) return num
  return null
}

function mapTime(v) {
  if (v === '' || v == null) return null
  if (typeof v === 'number') {
    // Excel guarda las horas como fracción de día
    const totalMin = Math.round(v * 24 * 60)
    const h = String(Math.floor(totalMin / 60)).padStart(2, '0')
    const m = String(totalMin % 60).padStart(2, '0')
    return `${h}:${m}`
  }
  const str = String(v).trim()
  const match = str.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`
  return null
}

export default function ImportStudentsModal({ onClose, onImported }) {
  const { user } = useAuth()
  const [step, setStep] = useState('pick') // pick | preview | done
  const [fileName, setFileName] = useState('')
  const [headerMap, setHeaderMap] = useState({})
  const [rows, setRows] = useState([]) // {ok, payload, error, raw}
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [parseError, setParseError] = useState('')

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: false })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        if (raw.length === 0) {
          setParseError('El archivo no tiene filas de datos.')
          return
        }
        const headers = Object.keys(raw[0])
        const hmap = detectHeaderMap(headers)
        setHeaderMap(hmap)

        const parsed = raw.map((r) => {
          const name = hmap.name ? String(r[hmap.name] || '').trim() : ''
          if (!name) return { ok: false, error: 'Sin nombre', raw: r }
          const { category, level } = hmap.category ? mapCategory(r[hmap.category]) : { category: null, level: null }
          const payload = {
            profesor_id: user.id,
            name,
            phone: hmap.phone ? String(r[hmap.phone] || '').trim() || null : null,
            gender: hmap.gender ? mapGender(r[hmap.gender]) : null,
            category,
            category_level: hmap.category_level ? String(r[hmap.category_level] || '').trim() || level : level,
            group_size: hmap.group_size ? mapGroupSize(r[hmap.group_size]) : 'individual',
            day_of_week: hmap.day_of_week ? mapDay(r[hmap.day_of_week]) : null,
            time_slot: hmap.time_slot ? mapTime(r[hmap.time_slot]) : null,
            status: 'active',
            notes: hmap.notes ? String(r[hmap.notes] || '').trim() || null : null,
          }
          return { ok: true, payload, raw: r }
        })
        setRows(parsed)
        setStep('preview')
      } catch (err) {
        setParseError('No pudimos leer el archivo. Probá exportarlo como .xlsx o .csv.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function doImport() {
    setImporting(true)
    const valid = rows.filter((r) => r.ok).map((r) => r.payload)
    let inserted = 0
    const chunkSize = 50
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize)
      const { error } = await supabase.from('students').insert(chunk)
      if (!error) inserted += chunk.length
    }
    setImporting(false)
    setResult({ inserted, skipped: rows.length - valid.length })
    setStep('done')
  }

  const validCount = rows.filter((r) => r.ok).length
  const invalidCount = rows.length - validCount
  const mappedFields = Object.keys(headerMap)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-lg max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">Importar alumnos desde Excel</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>

        {step === 'pick' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Subí tu planilla (.xlsx, .xls o .csv). Buscamos automáticamente columnas como Nombre, WhatsApp, Género, Categoría, Nivel, Tamaño de grupo, Día y Horario — no hace falta que estén en un orden particular.
            </p>
            <label className="btn-primary text-center cursor-pointer block">
              Elegir archivo
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
            </label>
            {fileName && <div className="text-xs text-slate-500">{fileName}</div>}
            {parseError && <div className="text-xs text-red-400">{parseError}</div>}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="card p-3 text-xs text-slate-400">
              Columnas detectadas: {mappedFields.length > 0 ? mappedFields.map((f) => headerMap[f]).join(', ') : 'ninguna — revisá los encabezados de tu planilla.'}
            </div>
            <div className="flex gap-2 text-sm">
              <span className="pill bg-brand/15 text-brand font-semibold">{validCount} listos para importar</span>
              {invalidCount > 0 && <span className="pill bg-amber-500/15 text-amber-400 font-semibold">{invalidCount} sin nombre (se omiten)</span>}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {rows.slice(0, 30).filter((r) => r.ok).map((r, i) => (
                <div key={i} className="card p-2.5 text-sm flex items-center justify-between">
                  <span className="font-medium">{r.payload.name}</span>
                  <span className="text-xs text-slate-500">
                    {r.payload.category ? `${r.payload.category}${r.payload.category_level || ''} · ` : ''}
                    {r.payload.gender ? `${r.payload.gender} · ` : ''}
                    {r.payload.phone || 'sin teléfono'}
                  </span>
                </div>
              ))}
              {rows.length > 30 && <div className="text-xs text-slate-500 text-center py-1">+ {rows.length - 30} más...</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('pick')} className="btn-secondary flex-1">Volver</button>
              <button onClick={doImport} disabled={importing || validCount === 0} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                <PlusIcon size={16} /> Importar {validCount}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 text-center py-4">
            <div className="text-4xl font-extrabold text-brand">{result.inserted}</div>
            <div className="text-sm text-slate-400">
              alumno{result.inserted !== 1 ? 's' : ''} importado{result.inserted !== 1 ? 's' : ''}
              {result.skipped > 0 ? ` · ${result.skipped} omitido${result.skipped !== 1 ? 's' : ''} por no tener nombre` : ''}
            </div>
            <button onClick={() => { onImported(); onClose() }} className="btn-primary">Listo</button>
          </div>
        )}
      </div>
    </div>
  )
}
