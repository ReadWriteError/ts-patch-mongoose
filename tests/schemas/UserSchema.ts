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
    required: false,
    default: undefined
  },
  address: {
    type: AddressSchema,
    required: false
  },
  company: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'Company'
  }
}, { timestamps: true })

export default UserSchema
