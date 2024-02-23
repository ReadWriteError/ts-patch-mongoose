import type { Types } from 'mongoose'

import type IAddress from './IAddress'

interface IUser {
  name: string
  role: string
  sessions: [string]
  address: IAddress
  company: Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

export default IUser
