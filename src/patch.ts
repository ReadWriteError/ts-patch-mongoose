import _ from 'lodash'
import omit from 'omit-deep'
import jsonpatch from 'fast-json-patch'

import type { HydratedDocument, Types } from 'mongoose'

import type IContext from './interfaces/IContext'
import type IPluginOptions from './interfaces/IPluginOptions'
import type { User, Reason, Metadata } from './interfaces/IPluginOptions'

import History from './models/History'
import em from './em'

export function getObjects<T> (opts: IPluginOptions<T>, current: HydratedDocument<T>, original: HydratedDocument<T>): { currentObject: Partial<T>, originalObject: Partial<T> } {
  let currentObject = JSON.parse(JSON.stringify(current)) as Partial<T>
  let originalObject = JSON.parse(JSON.stringify(original)) as Partial<T>

  if (opts.omit) {
    currentObject = omit(currentObject, opts.omit)
    originalObject = omit(originalObject, opts.omit)
  }

  return { currentObject, originalObject }
}

export async function getUser<T> (opts: IPluginOptions<T>): Promise<User | undefined> {
  if (_.isFunction(opts.getUser)) {
    return await opts.getUser()
  }
  return undefined
}

export async function getReason<T> (opts: IPluginOptions<T>): Promise<Reason | undefined> {
  if (_.isFunction(opts.getReason)) {
    return await opts.getReason()
  }
  return undefined
}

export async function getMetadata<T> (opts: IPluginOptions<T>): Promise<Metadata | undefined> {
  if (_.isFunction(opts.getMetadata)) {
    return await opts.getMetadata()
  }
  return undefined
}

export function getValue <T> (item: PromiseSettledResult<T>): T | undefined {
  return item.status === 'fulfilled' ? item.value : undefined
}

export async function getData<T> (opts: IPluginOptions<T>): Promise<[User | undefined, Reason | undefined, Metadata | undefined]> {
  return Promise
    .allSettled([getUser(opts), getReason(opts), getMetadata(opts)])
    .then(([user, reason, metadata]) => {
      return [
        getValue(user),
        getValue(reason),
        getValue(metadata)
      ]
    })
}

export async function bulkPatch<T> (opts: IPluginOptions<T>, context: IContext<T>, eventKey: 'eventCreated' | 'eventDeleted', docsKey: 'createdDocs' | 'deletedDocs'): Promise<void> {
  const event = opts[eventKey]
  const docs = context[docsKey]
  const key = eventKey === 'eventCreated' ? 'doc' : 'oldDoc'

  if (_.isEmpty(docs) || (!event && opts.patchHistoryDisabled)) return

  const [user, reason, metadata] = await getData(opts)

  const chunks = _.chunk(docs, 1000)

  for await (const chunk of chunks) {
    const bulk = []

    for (const doc of chunk) {
      if (event) em.emit(event, { [key]: doc })

      if (!opts.patchHistoryDisabled) {
        bulk.push({
          insertOne: {
            document: {
              op: context.op,
              modelName: context.modelName,
              collectionName: context.collectionName,
              collectionId: doc._id as Types.ObjectId,
              doc,
              user,
              reason,
              metadata,
              version: 0
            }
          }
        })
      }
    }

    if (!opts.patchHistoryDisabled) {
      await History.bulkWrite(bulk, { ordered: false })
    }
  }
}

export async function createPatch<T> (opts: IPluginOptions<T>, context: IContext<T>): Promise<void> {
  await bulkPatch(opts, context, 'eventCreated', 'createdDocs')
}

export async function updatePatch<T> (opts: IPluginOptions<T>, context: IContext<T>, current: HydratedDocument<T>, original: HydratedDocument<T>): Promise<void> {
  const { currentObject, originalObject } = getObjects(opts, current, original)

  if (_.isEmpty(originalObject) || _.isEmpty(currentObject)) return

  const patch = jsonpatch.compare(originalObject, currentObject, true)

  if (_.isEmpty(patch)) return

  if (opts.eventUpdated) {
    em.emit(opts.eventUpdated, { oldDoc: original, doc: current, patch })
  }

  if (opts.patchHistoryDisabled) return

  let version = 0

  const lastHistory = await History.findOne({ collectionId: original._id as Types.ObjectId }).sort('-version').exec()

  if (lastHistory && lastHistory.version >= 0) {
    version = lastHistory.version + 1
  }

  const [user, reason, metadata] = await getData(opts)

  await History.create({
    op: context.op,
    modelName: context.modelName,
    collectionName: context.collectionName,
    collectionId: original._id as Types.ObjectId,
    patch,
    user,
    reason,
    metadata,
    version
  })
}

export async function deletePatch<T> (opts: IPluginOptions<T>, context: IContext<T>): Promise<void> {
  await bulkPatch(opts, context, 'eventDeleted', 'deletedDocs')
}
