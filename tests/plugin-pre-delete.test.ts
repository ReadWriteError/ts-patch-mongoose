import { isMongooseLessThan7 } from '../src/version'
import mongoose, { model } from 'mongoose'

import UserSchema from './schemas/UserSchema'
import CompanySchema from './schemas/CompanySchema'
import { patchHistoryPlugin } from '../src/plugin'

import { USER_DELETED } from './constants/events'

import em from '../src/em'

const preDeleteMock = jest.fn()

jest.mock('../src/em', () => {
  return { emit: jest.fn() }
})

describe('plugin - preDelete test', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`

  UserSchema.plugin(patchHistoryPlugin, {
    eventDeleted: USER_DELETED,
    patchHistoryDisabled: true,
    preDelete: preDeleteMock
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

  it('should deleteMany and execute preDelete', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Jane', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Jack', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const users = await User.find({}).sort().lean().exec()
    expect(users).toHaveLength(3)

    const [john, jane, jack] = users

    await User.deleteMany({ role: 'user' })
    expect(preDeleteMock).toHaveBeenCalledTimes(1)
    expect(preDeleteMock).toHaveBeenCalledWith([john, jane, jack])

    expect(em.emit).toHaveBeenCalledTimes(3)
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: {
        __v: 0,
        _id: jane?._id,
        name: 'Jane',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: jane?.createdAt,
        updatedAt: jane?.updatedAt
      }
    })
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: {
        __v: 0,
        _id: john?._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: john?.createdAt,
        updatedAt: john?.updatedAt
      }
    })
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: {
        __v: 0,
        _id: jack?._id,
        name: 'Jack',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: jack?.createdAt,
        updatedAt: jack?.updatedAt
      }
    })
  })

  it('should deleteOne and execute preDelete', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Jane', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Jack', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const users = await User.find({}).sort().lean().exec()
    expect(users).toHaveLength(3)

    const [john] = users

    await User.deleteOne({ name: 'John' })
    expect(preDeleteMock).toHaveBeenCalledTimes(1)
    expect(preDeleteMock).toHaveBeenCalledWith([
      {
        __v: 0,
        _id: john?._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: john?.createdAt,
        updatedAt: john?.updatedAt
      }
    ])

    expect(em.emit).toHaveBeenCalledTimes(1)
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: {
        __v: 0,
        _id: john?._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: john?.createdAt,
        updatedAt: john?.updatedAt
      }
    })
  })

  it('should remove and execute preDelete', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    const john = await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    if (isMongooseLessThan7) {
      await john?.remove()
    } else {
      await john?.deleteOne()
    }

    expect(preDeleteMock).toHaveBeenCalledTimes(1)
    expect(preDeleteMock).toHaveBeenCalledWith([
      {
        __v: 0,
        _id: john?._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: john?.createdAt,
        updatedAt: john?.updatedAt
      }
    ])

    expect(em.emit).toHaveBeenCalledTimes(1)
    expect(em.emit).toHaveBeenCalledWith(USER_DELETED, {
      oldDoc: {
        __v: 0,
        _id: john?._id,
        name: 'John',
        role: 'user',
        sessions: ['192.168.0.1'],
        address: { city: 'Portland', state: 'Maine' },
        company: company._id,
        createdAt: john?.createdAt,
        updatedAt: john?.updatedAt
      }
    })
  })
})
