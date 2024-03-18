import type { ClientSession, HydratedDocument } from 'mongoose'

interface IContext<T> {
  op: string
  modelName: string
  collectionName: string
  isNew?: boolean
  createdDocs?: HydratedDocument<T>[]
  deletedDocs?: HydratedDocument<T>[]
  ignoreEvent?: boolean
  ignorePatchHistory?: boolean
  session?: ClientSession | undefined
}

export default IContext
