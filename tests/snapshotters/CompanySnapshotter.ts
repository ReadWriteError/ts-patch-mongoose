import type IHistory from '../../src/interfaces/IHistory'
import type { HydratedDocument } from 'mongoose'
import type ICompany from '../interfaces/ICompany'

export async function getCompanyHistorySnapshot(history: HydratedDocument<IHistory>, company?: HydratedDocument<ICompany>) {
  const historyDoc = history.doc as HydratedDocument<ICompany> | undefined
  return {
    version: history.version,
    op: history.op,
    modelName: history.modelName,
    collectionName: history.collectionName,
    collectionId: company ? history.collectionId.toString() === company._id.toString() : Boolean(history.collectionId).valueOf(),
    doc: historyDoc ? {
      _id: company ? historyDoc._id.toString() === company._id.toString() : Boolean(historyDoc._id).valueOf(),
      name: historyDoc.name,
      address: historyDoc.address,
      createdAt: Boolean(historyDoc.createdAt).valueOf(),
      updatedAt: Boolean(historyDoc.updatedAt).valueOf()
    } : undefined,
    patch: history.patch
  }
}