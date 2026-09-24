import { connection } from 'next/server'

export async function GET() {
  // Request-time by declaration: this handler is never prerendered.
  await connection()
  return Response.json({ status: 'ok' })
}
