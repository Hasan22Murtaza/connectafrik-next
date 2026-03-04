import { NextResponse } from 'next/server'

export function jsonResponse<T>(data: T, status = 200, message = 'Success') {
  return NextResponse.json({ success: true, data, message }, { status })
}

export function errorResponse(message: string, status = 500) {
  return NextResponse.json({ success: false, data: null, message }, { status })
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401)
}
