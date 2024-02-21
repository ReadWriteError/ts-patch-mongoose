import type IAddress from './IAddress'

interface ICompany {
  name: string
  address: IAddress
  createdAt?: Date
  updatedAt?: Date
}

export default ICompany