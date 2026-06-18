import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT /api/users/[id] - Update a user
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email } = body

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { name, email },
    })

    return NextResponse.json(updatedUser, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'User not found or update failed' }, { status: 400 })
  }
}

// DELETE /api/users/[id] - Remove a user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.user.delete({
      where: { id: Number(id) },
    })

    return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: 'User not found or deletion failed' }, { status: 400 })
  }
}
