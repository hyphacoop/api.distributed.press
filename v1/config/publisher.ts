import { NewPublisher, Publisher } from "../api/schemas";
import { Static } from '@sinclair/typebox'

export function createPublisher(_cfg: Static<typeof NewPublisher>): string {
  return "PLACEHOLDER_ID"
}

export function updatePublisher(_cfg: Static<typeof NewPublisher>) {
  return "PLACEHOLDER_ID"
}

export function getPublisher(id: string): Static<typeof Publisher> {
  return {
    id
  }
}

export function deletePublisher(id: string): void {
  console.log(id)
}
