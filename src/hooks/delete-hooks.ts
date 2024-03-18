import _ from 'lodash'

import { deletePatch } from '../patch'
import { isHookIgnored } from '../helpers'

import type { HydratedDocument, Model, MongooseQueryMiddleware, Schema } from 'mongoose'
import type IPluginOptions from '../interfaces/IPluginOptions'
import type IHookContext from '../interfaces/IHookContext'

const deleteMethods = [
  'remove',
  'findOneAndDelete',
  'findOneAndRemove',
  'findByIdAndDelete',
  'findByIdAndRemove',
  'deleteOne',
  'deleteMany',
]

export const deleteHooksInitialize = <T>(schema: Schema<T>, opts: IPluginOptions<T>): void => {
  schema.pre(deleteMethods as MongooseQueryMiddleware[], { document: false, query: true }, async function (this: IHookContext<T>) {
    const options = this.getOptions()
    if (isHookIgnored(options)) return

    const model = this.model as Model<T>
    const filter = this.getFilter()
    const sessionOption = options.session ? { session: options.session } : undefined

    this._context = {
      op: this.op,
      modelName: opts.modelName ?? this.model.modelName,
      collectionName: opts.collectionName ?? this.model.collection.collectionName,
      ignoreEvent: options['ignoreEvent'] as boolean,
      ignorePatchHistory: options['ignorePatchHistory'] as boolean,
      session: sessionOption?.session,
    }

    if (['remove', 'deleteMany'].includes(this._context.op) && !options['single']) {
      const docs = await model.find(filter, undefined, sessionOption).lean().exec()
      if (!_.isEmpty(docs)) {
        this._context.deletedDocs = docs as HydratedDocument<T>[]
      }
    } else {
      const doc = await model.findOne(filter, undefined, sessionOption).lean().exec()
      if (!_.isEmpty(doc)) {
        this._context.deletedDocs = [doc] as HydratedDocument<T>[]
      }
    }

    if (opts.preDelete && _.isArray(this._context.deletedDocs) && !_.isEmpty(this._context.deletedDocs)) {
      await opts.preDelete(this._context.deletedDocs)
    }
  })

  schema.post(deleteMethods as MongooseQueryMiddleware[], { document: false, query: true }, async function (this: IHookContext<T>) {
    const options = this.getOptions()
    if (isHookIgnored(options)) return

    await deletePatch(opts, this._context)
  })
}
