/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isMongooseLessThan7 } from '../src/version'

import mongoose from 'mongoose'

import UserSchema from './schemas/UserSchema'
import CompanySchema from './schemas/CompanySchema'
import { patchHistoryPlugin } from '../src/plugin'
import History from '../src/models/History'

import em from '../src/em'
import { USER_CREATED, USER_UPDATED, USER_DELETED } from './constants/events'

jest.mock('../src/em', () => {
  return { emit: jest.fn() }
})

describe('plugin', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`

  UserSchema.plugin(patchHistoryPlugin, {
    eventCreated: USER_CREATED,
    eventUpdated: USER_UPDATED,
    eventDeleted: USER_DELETED,
    omit: ['__v', 'role', 'createdAt', 'updatedAt']
  })

  const User = mongoose.model('User', UserSchema)
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
    expect(history).toHaveLength(3)

    const [first, second, third] = history

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

    // 2 update
    expect(second.version).toBe(1)
    expect(second.op).toBe('update')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')
    expect(second.collectionId).toEqual(user._id)

    expect(second.doc).toBeUndefined()

    expect(second.patch).toMatchObject([
      {'op': 'test', 'path': '/address/state', 'value': 'Maine'},
      {'op': 'replace', 'path': '/address/state', 'value': 'Oregon'},
      {'op': 'add', 'path': '/sessions/1', 'value': '192.168.0.2'},
      {'op': 'test', 'path': '/name', 'value': 'John'},
      {'op': 'replace', 'path': '/name', 'value': 'Alice'}
    ])

    // 3 delete
    expect(third.version).toBe(0)
    expect(third.op).toBe('deleteMany')
    expect(third.modelName).toBe('User')
    expect(third.collectionName).toBe('users')
    expect(third.collectionId).toEqual(user._id)

    expect(third.doc).toHaveProperty('_id', user._id)
    expect(third.doc).toHaveProperty('name', 'Alice')
    expect(third.doc).toHaveProperty('role', 'manager')
    expect(third.doc).toHaveProperty('sessions', ['192.168.0.1', '192.168.0.2'])
    expect(third.doc).toHaveProperty('address', { city: 'Portland', state: 'Oregon' })
    expect(third.doc).toHaveProperty('company', company._id)
    expect(third.doc).toHaveProperty('createdAt')
    expect(third.doc).toHaveProperty('updatedAt')

    expect(third.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(3)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_UPDATED, {
      oldDoc: expect.objectContaining({
        _id: user._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id
      }),
      doc: expect.objectContaining({
        _id: user._id,
        name: 'Alice',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      }),
      patch: second.patch
    })
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: expect.objectContaining({
        _id: user._id,
        name: 'Alice',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      })
    })
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

    // 2 update
    expect(second.version).toBe(1)
    expect(second.op).toBe('updateOne')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')
    expect(second.collectionId).toEqual(user._id)

    expect(second.doc).toBeUndefined()

    expect(second.patch).toMatchObject([
      {'op': 'test', 'path': '/address/state', 'value': 'Maine'},
      {'op': 'replace', 'path': '/address/state', 'value': 'Oregon'},
      {'op': 'add', 'path': '/sessions/1', 'value': '192.168.0.2'},
      {'op': 'test', 'path': '/name', 'value': 'John'},
      {'op': 'replace', 'path': '/name', 'value': 'Alice'}
    ])

    expect(em.emit).toHaveBeenCalledTimes(2)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_UPDATED, {
      oldDoc: expect.objectContaining({
        _id: user._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id
      }),
      doc: expect.objectContaining({
        _id: user._id,
        name: 'Alice',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      }),
      patch: second.patch
    })
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

    // 2 update
    expect(second.version).toBe(1)
    expect(second.op).toBe('findOneAndUpdate')
    expect(second.modelName).toBe('User')
    expect(second.collectionName).toBe('users')
    expect(second.collectionId).toEqual(user._id)

    expect(second.doc).toBeUndefined()

    expect(second.patch).toMatchObject([
      {'op': 'test', 'path': '/address/state', 'value': 'Maine'},
      {'op': 'replace', 'path': '/address/state', 'value': 'Oregon'},
      {'op': 'add', 'path': '/sessions/1', 'value': '192.168.0.2'},
      {'op': 'test', 'path': '/name', 'value': 'John'},
      {'op': 'replace', 'path': '/name', 'value': 'Alice'}
    ])

    expect(em.emit).toHaveBeenCalledTimes(2)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_UPDATED, {
      oldDoc: expect.objectContaining({
        _id: user._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id
      }),
      doc: expect.objectContaining({
        _id: user._id,
        name: 'Alice',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      }),
      patch: second.patch
    })
  })

  it('should create many', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Alice', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const history = await History.find({}).sort('doc.name')
    expect(history).toHaveLength(2)

    const [first, second] = history

    // 1 create
    expect(first.version).toBe(0)
    expect(first.op).toBe('create')
    expect(first.modelName).toBe('User')
    expect(first.collectionName).toBe('users')

    expect(first.doc).toHaveProperty('_id')
    expect(first.doc).toHaveProperty('name', 'Alice')
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

    expect(second.doc).toHaveProperty('_id')
    expect(second.doc).toHaveProperty('name', 'John')
    expect(second.doc).toHaveProperty('role', 'user')
    expect(second.doc).toHaveProperty('sessions', ['192.168.0.1'])
    expect(second.doc).toHaveProperty('address', { city: 'Portland', state: 'Maine' })
    expect(second.doc).toHaveProperty('company', company._id)
    expect(second.doc).toHaveProperty('createdAt')
    expect(second.doc).toHaveProperty('updatedAt')

    expect(second.patch).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(2)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: second.doc })
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

    expect(em.emit).toHaveBeenCalledTimes(1)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    // updated event is not emitted because it's an upsert
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
    expect(history).toHaveLength(4)

    const [first, second, third, fourth] = history

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

    // 3 update
    expect(third.version).toBe(1)
    expect(third.op).toBe('updateMany')
    expect(third.modelName).toBe('User')
    expect(third.collectionName).toBe('users')
    expect(third.collectionId).toEqual(john._id)

    expect(third.doc).toBeUndefined()

    expect(third.patch).toMatchObject([
      {'op': 'test', 'path': '/address/state', 'value': 'Maine'},
      {'op': 'replace', 'path': '/address/state', 'value': 'Oregon'},
      {'op': 'add', 'path': '/sessions/1', 'value': '192.168.0.2'},
      {'op': 'test', 'path': '/name', 'value': 'John'},
      {'op': 'replace', 'path': '/name', 'value': 'Bob'}
    ])

    // 3 update
    expect(fourth.version).toBe(1)
    expect(fourth.op).toBe('updateMany')
    expect(fourth.modelName).toBe('User')
    expect(fourth.collectionName).toBe('users')
    expect(fourth.collectionId).toEqual(alice._id)

    expect(fourth.doc).toBeUndefined()

    expect(fourth.patch).toMatchObject([
      {'op': 'test', 'path': '/address/state', 'value': 'Maine'},
      {'op': 'replace', 'path': '/address/state', 'value': 'Oregon'},
      {'op': 'add', 'path': '/sessions/1', 'value': '192.168.0.2'},
      {'op': 'test', 'path': '/name', 'value': 'Alice'},
      {'op': 'replace', 'path': '/name', 'value': 'Bob'}
    ])

    expect(em.emit).toHaveBeenCalledTimes(4)
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: first.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_CREATED, { doc: second.doc })
    expect(em.emit).toHaveBeenCalledWith(USER_UPDATED, {
      oldDoc: expect.objectContaining({
        _id: john._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id
      }),
      doc: expect.objectContaining({
        _id: john._id,
        name: 'Bob',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      }),
      patch: third.patch
    })
    expect(em.emit).toHaveBeenCalledWith(USER_UPDATED, {
      oldDoc: expect.objectContaining({
        _id: alice._id,
        name: 'Alice',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id
      }),
      doc: expect.objectContaining({
        _id: alice._id,
        name: 'Bob',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      }),
      patch: fourth.patch
    })
  })
})
