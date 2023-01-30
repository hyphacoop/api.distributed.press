declare module 'hyper-sdk' {
  export class Hyperdrive {
    once (evt: string, cb: () => void): void
    get url (): string
    close (): Promise<void>
  }

  export type HyperOpts = Partial<{
    storage: string
    corestoreOpts: {}
    swarmOpts: {}
  }>

  export class SDK {
    getDrive (nameOrKeyOrURL: string): Promise<Hyperdrive>
  }

  export function create (opts?: HyperOpts): Promise<SDK>
}
