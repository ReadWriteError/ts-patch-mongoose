import type { Types } from 'mongoose'

interface IUser {
  name: string
  role: string
  sessions?: [string]
  company?: Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

export default IUser
