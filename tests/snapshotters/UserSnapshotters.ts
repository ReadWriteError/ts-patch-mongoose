import type IHistory from '../../src/interfaces/IHistory'
import type IUser from '../interfaces/IUser'
import type { HydratedDocument } from 'mongoose'
import type ICompany from '../interfaces/ICompany'

export async function getUserHistorySnapshot(history: HydratedDocument<IHistory>, company: HydratedDocument<ICompany>, user?: HydratedDocument<IUser>) {
  const historyDoc = history.doc as HydratedDocument<IUser> | undefined
  return {
    version: history.version,
    op: history.op,
    modelName: history.modelName,
    collectionName: history.collectionName,
    collectionId: user ? history.collectionId.toString() === user._id.toString() : Boolean(history.collectionId).valueOf(),
    doc: historyDoc ? {
      _id: user ? historyDoc._id.toString() === user._id.toString() : Boolean(historyDoc._id).valueOf(),
      name: historyDoc.name,
      role: historyDoc.role,
      sessions: historyDoc.sessions,
      address: historyDoc.address,
      company: historyDoc.company?.toString() === company._id.toString(),
      createdAt: Boolean(historyDoc.createdAt).valueOf(),
      updatedAt: Boolean(historyDoc.updatedAt).valueOf()
    } : undefined,
    patch: history.patch
  }
}