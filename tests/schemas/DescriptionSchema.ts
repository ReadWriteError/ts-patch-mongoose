import { Schema } from 'mongoose'

import type IDescription from '../interfaces/IDescription'

const DescriptionSchema = new Schema<IDescription>({
  summary: {
    type: String,
    required: true,
  },
}, { timestamps: false })

export default DescriptionSchema
