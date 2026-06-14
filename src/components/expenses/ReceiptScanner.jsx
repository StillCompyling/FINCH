import { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '../../db/supabase.js'

const RL_KEY = 'finch-scan-timestamps'
const RL_MAX = 10
const RL_WINDOW = 60 * 60 * 1000

function getTimestamps() {
  try {
    const ts = JSON.parse(localStorage.getItem(RL_KEY) ?? '[]')
    return ts.filter((t) => t > Date.now() - RL_WINDOW)
  } catch {
    return []
  }
}

function recordScan() {
  const ts = getTimestamps()
  ts.push(Date.now())
  localStorage.setItem(RL_KEY, JSON.stringify(ts))
}

function blockedForMs() {
  const ts = getTimestamps()
  if (ts.length < RL_MAX) return 0
  return ts[0] + RL_WINDOW - Date.now()
}

async function resizeImage(file, maxPx = 600, quality = 0.5) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const ReceiptScanner = forwardRef(function ReceiptScanner({ onScan }, ref) {
  const fileRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [notice, setNotice] = useState(null)

  useImperativeHandle(ref, () => ({
    trigger: () => fileRef.current?.click(),
  }))

  const handleClick = () => {
    const ms = blockedForMs()
    if (ms > 0) {
      const mins = Math.ceil(ms / 60000)
      setNotice(`Scan limit reached — try again in ${mins} minute${mins !== 1 ? 's' : ''}`)
      return
    }
    setNotice(null)
    fileRef.current?.click()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    if (!allowed.includes(file.type) && !file.type.startsWith('image/')) {
      setNotice('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice('Image too large — try a closer photo')
      return
    }
    if (!navigator.onLine) {
      setNotice("You're offline — enter this one manually")
      return
    }

    setScanning(true)
    setNotice(null)

    try {
      let blob = await resizeImage(file, 600, 0.5)
      if (!blob) {
        blob = file
      } else {
        console.log('[scan] pass 1 size', Math.round(blob.size / 1024), 'KB')
        if (blob.size > 150 * 1024) {
          const blob2 = await resizeImage(blob, 400, 0.4)
          if (blob2) {
            blob = blob2
            console.log('[scan] pass 2 size', Math.round(blob.size / 1024), 'KB')
          }
        }
      }

      const dataUrl = await blobToBase64(blob)
      const imageBase64 = dataUrl.split(',')[1]

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setNotice('Please sign in again')
        setScanning(false)
        return
      }

      console.log('[scan] sending image', Math.round(imageBase64.length * 0.75 / 1024), 'KB')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)

      let res
      try {
        res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg' }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      console.log('[scan] response', res.status, res.ok)

      if (res.status === 401) throw Object.assign(new Error(), { code: 'auth' })
      if (res.status === 502) throw Object.assign(new Error(), { code: 'unavailable' })
      if (res.status === 422) throw Object.assign(new Error(), { code: 'unreadable' })
      if (!res.ok) throw Object.assign(new Error(), { code: 'unavailable' })

      const data = await res.json()
      recordScan()

      const thumbSrc = URL.createObjectURL(file)
      onScan({ data, thumbSrc })
    } catch (err) {
      if (err.name === 'AbortError') {
        setNotice('Taking too long — try again or enter manually')
      } else if (err.code === 'auth') {
        setNotice('Please sign in again')
      } else if (err.code === 'unreadable') {
        setNotice("Couldn't read receipt — enter manually")
      } else {
        setNotice('Receipt scanning unavailable — enter manually')
      }
    } finally {
      setScanning(false)
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handleFile}
      />

      {scanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 backdrop-blur-sm">
          <div className="rounded-[8px] border-[1.5px] border-ink bg-paper-raised px-7 py-5 shadow-card text-center">
            <Spinner />
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
              Reading receipt…
            </p>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+4rem)] left-4 right-4 z-40 sm:left-auto sm:right-10 sm:w-80">
          <div className="flex items-start gap-2 rounded-[8px] border-[1.5px] border-ink bg-paper-raised px-4 py-3 shadow-card">
            <p className="flex-1 text-xs leading-relaxed text-ink">{notice}</p>
            <button
              onClick={() => setNotice(null)}
              className="mt-px shrink-0 text-sm leading-none text-ink-faint hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <button
        onClick={handleClick}
        disabled={scanning}
        title="Scan receipt"
        aria-label="Scan receipt"
        className="flex h-14 w-14 items-center justify-center rounded-[8px] border-[1.5px] border-ink
          bg-paper-raised text-ink shadow-[3px_3px_0_0_var(--color-ink)]
          transition-transform active:translate-x-[3px] active:translate-y-[3px] active:shadow-none
          disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CameraIcon />
      </button>
    </>
  )
})

function Spinner() {
  return (
    <svg className="mx-auto h-6 w-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
