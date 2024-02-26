/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isMongooseLessThan7 } from '../src/version'

import mongoose, { model } from 'mongoose'

import UserSchema from './schemas/UserSchema'
import CompanySchema from './schemas/CompanySchema'
import { patchHistoryPlugin } from '../src/plugin'
import History from '../src/models/History'

import em from '../src/em'

jest.mock('../src/em', () => {
  return { emit: jest.fn() }
})

describe('plugin - patch history disabled', () => {
  const uri = `${globalThis.__MONGO_URI__}${globalThis.__MONGO_DB_NAME__}`

  UserSchema.plugin(patchHistoryPlugin, {
    patchHistoryDisabled: true
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

    const history = await History.find({})
    expect(history).toHaveLength(0)

    await User.deleteMany({ role: 'user' }).exec()

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
    expect(history).toHaveLength(0)

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
    expect(history).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })

  it('should create many', async () => {
    const company = await Company.create({name: 'Google', address: {city: 'Mountain View', state: 'California'}})
    await User.create({ name: 'John', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })
    await User.create({ name: 'Alice', role: 'user', sessions: ['192.168.0.1'], address: {city: 'Portland', state: 'Maine'}, company: company })

    const history = await History.find({})
    expect(history).toHaveLength(0)

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
    expect(history).toHaveLength(0)

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
    expect(history).toHaveLength(0)

    expect(em.emit).toHaveBeenCalledTimes(0)
  })
})
