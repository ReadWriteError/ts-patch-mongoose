/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isMongooseLessThan7 } from '../src/version'

import mongoose, { Types, model } from 'mongoose'

import UserSchema from './schemas/UserSchema'
import CompanySchema from './schemas/CompanySchema'
import { patchHistoryPlugin } from '../src/plugin'
import History from '../src/models/History'

import em from '../src/em'

jest.mock('../src/em', () => {
  return { emit: jest.fn() }
})

describe('plugin - omit all', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`

  UserSchema.plugin(patchHistoryPlugin, {
    omit: ['__v', 'name', 'role', 'sessions', 'address', 'company', 'createdAt', 'updatedAt']
  })

  const User = model('User', UserSchema)
  const Company = mongoose.model('Company', CompanySchema)

  beforeAll(async () => {
    await mongoose.connect(uri)
  })

  afterAll(async () => {
    await mongoose.connection.close()
  })

  beforeEach(async () => {
    await mongoose.connection.collection('users').deleteMany({})
    await mongoose.connection.collection('companies').deleteMany({})
    await mongoose.connection.collection('history').deleteMany({})
  })

  it('should createHistory', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    const user = await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    expect(user.name).toBe('John')

    user.name = 'Alice'
    user.role = 'manager'
    user.sessions!.push('192.168.0.2')
    user.address!.state = 'Oregon'
    await user.save()

    await User.deleteMany({}).exec()

    const history = await History.find({})
    expect(history).toHaveLength(2)

    const [first, second] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')
    expect(first.collectionId).toEqual(user._id)

    expect(first.doc).toHaveProperty('_id', user._id)
    expect(first.doc).toHaveProperty('name', 'John')
    expect(first.doc).toHaveProperty('role', 'user')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(first.doc).toHaveProperty('company', company._id)
    expect(first.doc).toHaveProperty('createdAt')
    expect(first.doc).toHaveProperty('updatedAt')

    expect(first.patch).toHaveLength(0)

    // 2 delete
    expect(second.version).toBe(0)
    expect(second.op).toBe('deleteMany')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')
    expect(second.collectionId).toEqual(user._id)

    expect(second.doc).toHaveProperty('_id', user._id)
    expect(second.doc).toHaveProperty('name', 'Alice')
    expect(second.doc).toHaveProperty('role', 'manager')
    expect(second.doc).toHaveProperty('sessions', ['192.168.0.1', '192.168.0.2'])
    expect(second.doc).toHaveProperty('address', { city: 'Portland', state: 'Oregon' })
    expect(second.doc).toHaveProperty('company', company._id)
    expect(second.doc).toHaveProperty('createdAt')
    expect(second.doc).toHaveProperty('updatedAt')

    expect(second.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should updateOne', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    const user = await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    expect(user.name).toBe('John')

    await User.updateOne({ _id: user._id }, {
      name: 'Alice',
      role: 'manager',
      $push: { sessions: '192.168.0.2' },
      address: { city: 'Portland', state: 'Oregon' }
    }).exec()

    const history = await History.find({})
    expect(history).toHaveLength(1)

    const [first] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')
    expect(first.collectionId).toEqual(user._id)

    expect(first.doc).toHaveProperty('_id', user._id)
    expect(first.doc).toHaveProperty('name', 'John')
    expect(first.doc).toHaveProperty('role', 'user')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(first.doc).toHaveProperty('company', company._id)
    expect(first.doc).toHaveProperty('createdAt')
    expect(first.doc).toHaveProperty('updatedAt')

    expect(first.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should findOneAndUpdate', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    const user = await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    expect(user.name).toBe('John')

    if (isMongooseLessThan7) {
      await User.update({ _id: user._id }, {
        name: 'Alice',
        role: 'manager',
        $push: { sessions: '192.168.0.2' },
        address: { city: 'Portland', state: 'Oregon' }
      }).exec()
    } else {
      await User.findOneAndUpdate({ _id: user._id }, {
        name: 'Alice',
        role: 'manager',
        $push: { sessions: '192.168.0.2' },
        address: { city: 'Portland', state: 'Oregon' }
      }).exec()
    }

    const history = await History.find({})
    expect(history).toHaveLength(1)

    const [first] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')
    expect(first.collectionId).toEqual(user._id)

    expect(first.doc).toHaveProperty('_id', user._id)
    expect(first.doc).toHaveProperty('name', 'John')
    expect(first.doc).toHaveProperty('role', 'user')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(first.doc).toHaveProperty('company', company._id)
    expect(first.doc).toHaveProperty('createdAt')
    expect(first.doc).toHaveProperty('updatedAt')

    expect(first.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should create many', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Alice', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const history = await History.find({}).sort('doc.name')
    expect(history).toHaveLength(2)

    const [first, second] = history

    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')
    expect(first.collectionId).toBeInstanceOf(Types.ObjectId)
    expect(first.version).toBe(0)
    expect(first.patch).toHaveLength(0)

    expect(first.doc).toHaveProperty('_id')
    expect(first.doc).toHaveProperty('name', 'Alice')
    expect(first.doc).toHaveProperty('role', 'user')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(first.doc).toHaveProperty('company', company._id)
    expect(first.doc).toHaveProperty('createdAt')
    expect(first.doc).toHaveProperty('updatedAt')

    expect(second.op).toBe('create')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')
    expect(second.collectionId).toBeInstanceOf(Types.ObjectId)
    expect(second.version).toBe(0)
    expect(second.patch).toHaveLength(0)

    expect(second.doc).toHaveProperty('_id')
    expect(second.doc).toHaveProperty('name', 'John')
    expect(second.doc).toHaveProperty('role', 'user')
    expect(second.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(second.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(second.doc).toHaveProperty('company', company._id)
    expect(second.doc).toHaveProperty('createdAt')
    expect(second.doc).toHaveProperty('updatedAt')

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should findOneAndUpdate upsert', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.findOneAndUpdate({ name: 'John' }, {
      name: 'Alice',
      role: 'manager',
      $push: { sessions: '192.168.0.2' },
      address: { city: 'Portland', state: 'Oregon' },
      company: company
    }, { upsert: true, runValidators: true }).exec()
    const documents = await User.find({})
    expect(documents).toHaveLength(1)

    const history = await History.find({})
    expect(history).toHaveLength(1)

    const [first] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('findOneAndUpdate')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')

    expect(first.doc).toHaveProperty('_id')
    expect(first.doc).toHaveProperty('name', 'Alice')
    expect(first.doc).toHaveProperty('role', 'manager')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.2'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Oregon' })
    expect(first.doc).toHaveProperty('company', company._id)

    // Upsert don't have createdAt, updatedAt, or validation errors
    // Investigate this case later
    // expect(first.doc).toHaveProperty('createdAt')
    // expect(first.doc).toHaveProperty('updatedAt')

    expect(first.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should update many', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    const john = await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    expect(john.name).toBe('John')
    const alice = await User.create({ name: 'Alice', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    expect(alice.name).toBe('Alice')

    if (isMongooseLessThan7) {
      await User.update({}, {
        name: 'Bob',
        role: 'manager',
        $push: { sessions: '192.168.0.2' },
        address: { city: 'Portland', state: 'Oregon' }
      }, { multi: true }).exec()
    } else {
      await User.updateMany({}, {
        name: 'Bob',
        role: 'manager',
        $push: { sessions: '192.168.0.2' },
        address: { city: 'Portland', state: 'Oregon' }
      }).exec()
    }

    const history = await History.find({})
    expect(history).toHaveLength(2)

    const [first, second] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')
    expect(first.collectionId).toEqual(john._id)

    expect(first.doc).toHaveProperty('_id', john._id)
    expect(first.doc).toHaveProperty('name', 'John')
    expect(first.doc).toHaveProperty('role', 'user')
    expect(first.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(first.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(first.doc).toHaveProperty('company', company._id)
    expect(first.doc).toHaveProperty('createdAt')
    expect(first.doc).toHaveProperty('updatedAt')

    expect(first.patch).toHaveLength(0)

    // 2 create
    expect(second.version).toBe(0)
    expect(second.op).toBe('create')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')

    expect(second.doc).toHaveProperty('_id', alice._id)
    expect(second.doc).toHaveProperty('name', 'Alice')
    expect(second.doc).toHaveProperty('role', 'user')
    expect(second.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(second.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(second.doc).toHaveProperty('company', company._id)
    expect(second.doc).toHaveProperty('createdAt')
    expect(second.doc).toHaveProperty('updatedAt')

    expect(second.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })
})
