import { Schema } from 'mongoose'

import type IAddress from '../interfaces/IAddress'

const AddressSchema = new Schema<IAddress>({
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  }
}, { timestamps: false })

export default AddressSchema