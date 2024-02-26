/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isMongooseLessThan7 } from '../src/version'

import mongoose from 'mongoose'

import UserSchema from './schemas/UserSchema'
import CompanySchema from './schemas/CompanySchema'
import { patchHistoryPlugin } from '../src/plugin'
import History from '../src/models/History'
import { getUserHistorySnapshot } from './snapshotters/UserSnapshotters'
import { getCompanyHistorySnapshot } from './snapshotters/CompanySnapshotter'

import em from '../src/em'
import { GLOBAL_CREATED, GLOBAL_UPDATED, GLOBAL_DELETED } from './constants/events'

jest.mock('../src/em', () => {
  return { emit: jest.fn() }
})

describe('plugin - global', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`

  mongoose.plugin(patchHistoryPlugin, {
    eventCreated: GLOBAL_CREATED,
    eventUpdated: GLOBAL_UPDATED,
    eventDeleted: GLOBAL_DELETED,
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

    await Company.deleteMany({}).exec()
    await User.deleteMany({}).exec()

    const history = await History.find({})
    expect(history).toHaveLength(5)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)
    
    expect(await getUserHistorySnapshot(history[1], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "John",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[2], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": undefined,
  "modelName": "User",
  "op": "update",
  "patch": [
    {
      "op": "test",
      "path": "/address/state",
      "value": "Maine",
    },
    {
      "op": "replace",
      "path": "/address/state",
      "value": "Oregon",
    },
    {
      "op": "add",
      "path": "/sessions/1",
      "value": "192.168.0.2",
    },
    {
      "op": "test",
      "path": "/name",
      "value": "John",
    },
    {
      "op": "replace",
      "path": "/name",
      "value": "Alice",
    },
  ],
  "version": 1,
}
`)

    expect(await getCompanyHistorySnapshot(history[3], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "deleteMany",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[4], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Oregon",
    },
    "company": true,
    "createdAt": true,
    "name": "Alice",
    "role": "manager",
    "sessions": [
      "192.168.0.1",
      "192.168.0.2",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "deleteMany",
  "patch": [],
  "version": 0,
}
`)

    expect(em.emit).toHaveBeenCalledTimes(5)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_UPDATED, {
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
      patch: history[2].patch
    })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_DELETED, {
      oldDoc: expect.objectContaining({
        _id: user._id,
        name: 'Alice',
        role: 'manager',
        sessions: ['192.168.0.1', '192.168.0.2'],
        address: { city: 'Portland', state: 'Oregon' },
        company: company._id
      })
    })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_DELETED, {
      oldDoc: expect.objectContaining({
        _id: company._id,
        name: 'Google',
        address: { city: 'Mountain View', state: 'California' }
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
    expect(history).toHaveLength(3)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)
    
    expect(await getUserHistorySnapshot(history[1], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "John",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[2], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": undefined,
  "modelName": "User",
  "op": "updateOne",
  "patch": [
    {
      "op": "test",
      "path": "/address/state",
      "value": "Maine",
    },
    {
      "op": "replace",
      "path": "/address/state",
      "value": "Oregon",
    },
    {
      "op": "add",
      "path": "/sessions/1",
      "value": "192.168.0.2",
    },
    {
      "op": "test",
      "path": "/name",
      "value": "John",
    },
    {
      "op": "replace",
      "path": "/name",
      "value": "Alice",
    },
  ],
  "version": 1,
}
`)

    expect(em.emit).toHaveBeenCalledTimes(3)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_UPDATED, {
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
      patch: history[2].patch
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
    expect(history).toHaveLength(3)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)
    
    expect(await getUserHistorySnapshot(history[1], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "John",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[2], company, user)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": undefined,
  "modelName": "User",
  "op": "findOneAndUpdate",
  "patch": [
    {
      "op": "test",
      "path": "/address/state",
      "value": "Maine",
    },
    {
      "op": "replace",
      "path": "/address/state",
      "value": "Oregon",
    },
    {
      "op": "add",
      "path": "/sessions/1",
      "value": "192.168.0.2",
    },
    {
      "op": "test",
      "path": "/name",
      "value": "John",
    },
    {
      "op": "replace",
      "path": "/name",
      "value": "Alice",
    },
  ],
  "version": 1,
}
`)

    expect(em.emit).toHaveBeenCalledTimes(3)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_UPDATED, {
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
      patch: history[2].patch
    })
  })

  it('should create many', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Alice', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const history = await History.find({})
    expect(history).toHaveLength(3)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[1], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "John",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[2], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "Alice",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)


    expect(em.emit).toHaveBeenCalledTimes(3)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[2].doc })
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
    expect(history).toHaveLength(2)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[1], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Oregon",
    },
    "company": true,
    "createdAt": true,
    "name": "Alice",
    "role": "manager",
    "sessions": [
      "192.168.0.2",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "findOneAndUpdate",
  "patch": [],
  "version": 0,
}
`)

    expect(em.emit).toHaveBeenCalledTimes(2)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
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
    expect(history).toHaveLength(5)

    expect(await getCompanyHistorySnapshot(history[0], company)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "companies",
  "doc": {
    "_id": true,
    "address": {
      "city": "Mountain View",
      "state": "California",
    },
    "createdAt": true,
    "name": "Google",
    "updatedAt": true,
  },
  "modelName": "Company",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[1], company, john)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "John",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[2], company, alice)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": {
    "_id": true,
    "address": {
      "city": "Portland",
      "state": "Maine",
    },
    "company": true,
    "createdAt": true,
    "name": "Alice",
    "role": "user",
    "sessions": [
      "192.168.0.1",
    ],
    "updatedAt": true,
  },
  "modelName": "User",
  "op": "create",
  "patch": [],
  "version": 0,
}
`)

    expect(await getUserHistorySnapshot(history[3], company, john)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": undefined,
  "modelName": "User",
  "op": "updateMany",
  "patch": [
    {
      "op": "test",
      "path": "/address/state",
      "value": "Maine",
    },
    {
      "op": "replace",
      "path": "/address/state",
      "value": "Oregon",
    },
    {
      "op": "add",
      "path": "/sessions/1",
      "value": "192.168.0.2",
    },
    {
      "op": "test",
      "path": "/name",
      "value": "John",
    },
    {
      "op": "replace",
      "path": "/name",
      "value": "Bob",
    },
  ],
  "version": 1,
}
`)

    expect(await getUserHistorySnapshot(history[4], company, alice)).toMatchInlineSnapshot(`
{
  "collectionId": true,
  "collectionName": "users",
  "doc": undefined,
  "modelName": "User",
  "op": "updateMany",
  "patch": [
    {
      "op": "test",
      "path": "/address/state",
      "value": "Maine",
    },
    {
      "op": "replace",
      "path": "/address/state",
      "value": "Oregon",
    },
    {
      "op": "add",
      "path": "/sessions/1",
      "value": "192.168.0.2",
    },
    {
      "op": "test",
      "path": "/name",
      "value": "Alice",
    },
    {
      "op": "replace",
      "path": "/name",
      "value": "Bob",
    },
  ],
  "version": 1,
}
`)

    expect(em.emit).toHaveBeenCalledTimes(5)
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[0].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[1].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_CREATED, { doc: history[2].doc })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_UPDATED, {
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
      patch: history[3].patch
    })
    expect(em.emit).toHaveBeenCalledWith(GLOBAL_UPDATED, {
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
      patch: history[4].patch
    })
  })
})
