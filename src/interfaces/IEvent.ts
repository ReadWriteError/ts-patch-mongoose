import type { Operation } from 'fast-json-patch'
import type { ClientSession, HydratedDocument } from 'mongoose'

interface IEvent<T> {
  oldDoc?: HydratedDocument<T>
  doc?: HydratedDocument<T>
  patch?: Operation[]
  session?: ClientSession
}

export default IEvent
