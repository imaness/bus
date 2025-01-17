export class PersistenceNotConfigured extends Error {
  readonly help: string

  constructor () {
    super(`Persistence not configured`)
    this.help = 'Ensure that Bus.configure().withPersistence() has been called prior to initialization'

    // tslint:disable-next-line:no-unsafe-any
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
