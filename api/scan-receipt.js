export const config = { runtime: 'edge' }

const RECEIPT_PROMPT = `
You are a receipt parser for a personal finance app used in the Netherlands and Europe.
Extract data from this receipt image and return ONLY a valid JSON object.
No markdown, no code fences, no explanation — just raw JSON.

{
  "merchant": "store or restaurant name",
  "total_amount_cents": 1234,
  "date": "YYYY-MM-DD",
  "suggested_category": "must be exactly one of: Groceries, Dining, Transport, Rent/Bills, Shopping, Health, Entertainment, Subscriptions, Other",
  "note": "merchant name or brief description max 60 chars",
  "items": ["item 1", "item 2"],
  "confidence": "high|medium|low",
  "currency": "EUR"
}

Rules:
- European decimal format: €12,34 = 1234 cents. €1.234,56 = 123456 cents
- Total = final amount paid including VAT/BTW, not subtotal
- If multiple totals visible, use the largest
- Date must be YYYY-MM-DD. If no date visible, use today
- If total unreadable, set total_amount_cents to 0 and confidence to low
- Common Dutch merchants: Albert Heijn → Groceries, Jumbo → Groceries,
  NS → Transport, Etos → Health, HEMA → Shopping, MediaMarkt → Shopping
- Return ONLY the JSON object, nothing else
`

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseKey,
    },
  })
  if (!userRes.ok) {
    return new Response('Unauthorized', { status: 401 })
  }
  const user = await userRes.json()
  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const { imageBase64, mimeType } = body
  if (!imageBase64 || !mimeType) {
    return new Response('Missing imageBase64 or mimeType', { status: 400 })
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  if (!allowed.includes(mimeType)) {
    return new Response('Invalid image type', { status: 400 })
  }

  const geminiKey = process.env.GEMINI_API_KEY
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: RECEIPT_PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    },
  )

  if (!geminiRes.ok) {
    const err = await geminiRes.text()
    console.error('Gemini error:', err)
    return new Response(
      JSON.stringify({ error: 'Receipt scanning unavailable' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const geminiData = await geminiRes.json()
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed
  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('Gemini returned non-JSON:', text)
    return new Response(
      JSON.stringify({ error: 'Could not read receipt' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (typeof parsed.total_amount_cents !== 'number') {
    parsed.total_amount_cents = 0
    parsed.confidence = 'low'
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}
