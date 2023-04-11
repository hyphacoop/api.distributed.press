import { AbstractLevel } from 'abstract-level'

// NB: ideally, this Config class takes in a generic param `T`
// so that `db` can be `AbstractLevel<any, string, T>` however
// the typings force .sublevel() to product an `AbstractSublevel<any, string, string>`
export abstract class Config<T> {
  protected db: AbstractLevel<any, string, T>
  constructor (db: AbstractLevel<any, string, any>) {
    this.db = db
  }

  async keys (): Promise<string[]> {
    return await this.db.keys().all()
  }
}
