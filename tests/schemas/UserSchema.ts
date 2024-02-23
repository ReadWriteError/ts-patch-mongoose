import { Schema } from 'mongoose'

import AddressSchema from './AddressSchema'

import type IUser from '../interfaces/IUser'

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  sessions: {
    type: [String],
    required: true,
    default: undefined
  },
  address: {
    type: AddressSchema,
    required: true
  },
  company: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'Company'
  }
}, { timestamps: true })

export default UserSchema
