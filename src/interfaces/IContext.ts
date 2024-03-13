import type { HydratedDocument, ClientSession } from 'mongoose'

interface IContext<T> {
  op: string
  modelName: string
  collectionName: string
  isNew?: boolean
  session?: ClientSession
  createdDocs?: HydratedDocument<T>[]
  deletedDocs?: HydratedDocument<T>[]
  oldDocs?: HydratedDocument<T>[]
  ignoreEvent?: boolean
  ignorePatchHistory?: boolean
}

export default IContext
