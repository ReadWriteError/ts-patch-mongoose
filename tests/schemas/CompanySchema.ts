import { Schema } from 'mongoose'

import AddressSchema from './AddressSchema'

import type ICompany from '../interfaces/ICompany'

const CompanySchema = new Schema<ICompany>({
  name: {
    type: String,
    required: true
  },
  address: {
    type: AddressSchema,
    required: true
  }
}, { timestamps: true })

export default CompanySchema