import _ from 'lodash'
import { assign } from 'power-assign'

import { createPatch, updatePatch } from '../patch'
import { isHookIgnored, toObjectOptions } from '../helpers'

import type { HydratedDocument, Model, MongooseQueryMiddleware, Schema, UpdateQuery, UpdateWithAggregationPipeline } from 'mongoose'
import type IPluginOptions from '../interfaces/IPluginOptions'
import type IHookContext from '../interfaces/IHookContext'

const updateMethods = [
  'update',
  'updateOne',
  'replaceOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findByIdAndUpdate',
]

export const assignUpdate = <T>(document: HydratedDocument<T>, update: UpdateQuery<T>, commands: Record<string, unknown>[]): HydratedDocument<T> => {
  let updated = assign(document.toObject(toObjectOptions), update)
  _.forEach(commands, (command) => {
    try {
      updated = assign(updated, command)
    } catch {
      // we catch assign keys that are not implemented
    }
  })

  const doc = document.set(updated).toObject(toObjectOptions) as HydratedDocument<T> & { createdAt?: Date }
  if (update['createdAt'])
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    doc.createdAt = update['createdAt']
  return doc
}

export const splitUpdateAndCommands = <T>(updateQuery: UpdateWithAggregationPipeline | UpdateQuery<T> | null): { update: UpdateQuery<T>, commands: Record<string, unknown>[] } => {
  let update: UpdateQuery<T> = {}
  const commands: Record<string, unknown>[] = []

  if (!_.isEmpty(updateQuery) && !_.isArray(updateQuery) && _.isObjectLike(updateQuery)) {
    update = _.cloneDeep(updateQuery)
    const keys = _.keys(update).filter((key) => key.startsWith('$'))
    if (!_.isEmpty(keys)) {
      _.forEach(keys, (key) => {
        commands.push({ [key]: update[key] as unknown })
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete update[key]
      })
    }
  }

  return { update, commands }
}

export const updateHooksInitialize = <T>(schema: Schema<T>, opts: IPluginOptions<T>): void => {
  schema.pre(updateMethods as MongooseQueryMiddleware[], async function (this: IHookContext<T>) {
    const options = this.getOptions()
    if (isHookIgnored(options)) return

    const model = this.model as Model<T>
    const filter = this.getFilter()
    const sessionOption = options.session ? { session: options.session } : undefined

    const oldDocs = await model.find(filter, undefined, sessionOption).lean().exec() as HydratedDocument<T>[]

    this._context = {
      op: this.op,
      modelName: opts.modelName ?? this.model.modelName,
      collectionName: opts.collectionName ?? this.model.collection.collectionName,
      isNew: Boolean(options.upsert) && oldDocs.length === 0,
      ignoreEvent: options['ignoreEvent'] as boolean,
      ignorePatchHistory: options['ignorePatchHistory'] as boolean,
      updatedDocsOld: oldDocs,
      session: sessionOption?.session,
    }
  })

  schema.post(updateMethods as MongooseQueryMiddleware[], async function (this: IHookContext<T>) {
    const options = this.getOptions()
    if (isHookIgnored(options)) return

    const model = this.model as Model<T>
    const sessionOption = this._context.session ? { session: this._context.session } : undefined
    const updateQuery = this.getUpdate()
    const { update, commands } = splitUpdateAndCommands(updateQuery)

    if (this._context.isNew) {
      const filter = assignUpdate(model.hydrate({}), update, commands)
      if (!_.isEmpty(filter)) {
        const current = await model.findOne(update, undefined, sessionOption).lean().exec()
        if (current) {
          this._context.createdDocs = [current] as HydratedDocument<T>[]

          await createPatch(opts, this._context)
        }
      }
    } else {
      const bothDocs = await Promise.all(this._context.updatedDocsOld?.map(async (oldDoc) => {
        return [
          oldDoc,
          await model.findById(oldDoc._id, undefined, sessionOption).lean().exec(),
        ]
      }) ?? [])
      for (const [oldDoc, doc] of bothDocs)
        await updatePatch(opts, this._context, doc as HydratedDocument<T>, oldDoc as HydratedDocument<T>)
    }
  })
}
