import levelup, { LevelUp } from 'levelup';
import leveldown from 'leveldown';
import { AbstractLevelDOWN } from 'abstract-leveldown'

/// Creates a new config database
/// By default, creates a LevelDB instance
export function makeDB(db?: AbstractLevelDOWN) {
  db = (db === undefined) ? leveldown('./store') : db
  return levelup(db)
}

export abstract class Config<T> {
  db: LevelUp<AbstractLevelDOWN<string, T>>

  constructor(db: LevelUp) {
    this.db = db;
  }
  
  abstract getKeyPrefix(): string
  wrapWithKeyPrefix(id: string): string {
    return `${this.getKeyPrefix}_${id}`
  }
}
