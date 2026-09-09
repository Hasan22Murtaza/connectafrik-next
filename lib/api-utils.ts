import { NextResponse } from 'next/server'

export function jsonResponse<T>(data: T, status = 200, message = 'Success') {
  return NextResponse.json({ success: true, data, message }, { status })
}

export function errorResponse(
  message: string,
  status = 500,
  extra?: { code?: string }
) {
  return NextResponse.json(
    { success: false, data: null, message, ...(extra?.code ? { code: extra.code } : {}) },
    { status }
  )
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401)
}

export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 403)
}
