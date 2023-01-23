declare module 'hyper-sdk' {
  export interface CorestoreOpts {

  }

  export interface SwarmOpts {

  }

  export class Hyperdrive {
    once (evt: string, cb: () => void): void
    get url (): string
    close (): Promise<void>
  }

  export type HyperOpts = Partial<{
    storage: string
    corestoreOpts: CorestoreOpts
    swarmOpts: SwarmOpts
  }>

  export class SDK {
    getDrive (nameOrKeyOrURL: string): Promise<Hyperdrive>
  }

  export function create (opts?: HyperOpts): Promise<SDK>
}
