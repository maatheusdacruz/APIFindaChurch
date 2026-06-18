import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users - Fetch all users
export async function GET() {
  try {
    const users = await prisma.user.findMany()
    return NextResponse.json(users, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/users - Create a new user
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const newUser = await prisma.user.create({
      data: { email, name },
    })

    return NextResponse.json(newUser, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'User already exists or database error' }, { status: 500 })
  }
}
