import { NextResponse } from 'next/server'

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401)
}
