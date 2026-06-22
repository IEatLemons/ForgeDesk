export type GitAuthorIdentity = {
  name: string
  email: string
}

export type GitAuthorPerson = {
  id: string
  displayName: string
  identities: GitAuthorIdentity[]
}

export type GitAuthorLookup = {
  byIdentity: Map<string, GitAuthorPerson>
  byEmail: Map<string, GitAuthorPerson>
  byName: Map<string, GitAuthorPerson>
}

export type ResolvedGitAuthorDisplay = {
  authorDisplayName: string
  authorDisplayEmail: string
  mappedPersonId: string
}

function identityKey(name: string, email: string): string {
  return `${name.trim().toLowerCase()} <${email.trim().toLowerCase()}>`
}

function emailIdentityKey(email: string): string {
  return email.trim().toLowerCase()
}

function nameIdentityKey(name: string): string {
  return name.trim().toLowerCase()
}

function firstPersonEmail(person: GitAuthorPerson | undefined): string {
  return person?.identities.find((identity) => identity.email.trim())?.email.trim() ?? ''
}

export function buildGitAuthorLookup(people: GitAuthorPerson[]): GitAuthorLookup {
  const byIdentity = new Map<string, GitAuthorPerson>()
  const byEmail = new Map<string, GitAuthorPerson>()
  const byName = new Map<string, GitAuthorPerson>()

  for (const person of people) {
    for (const identity of person.identities) {
      const name = identity.name.trim()
      const email = identity.email.trim()

      byIdentity.set(identityKey(name, email), person)

      if (email) {
        byEmail.set(emailIdentityKey(email), person)
      }

      if (name && !email) {
        byName.set(nameIdentityKey(name), person)
      }
    }
  }

  return { byIdentity, byEmail, byName }
}

export function resolveGitAuthorDisplay(
  author: {
    authorName: string
    authorEmail: string
  },
  lookup: GitAuthorLookup
): ResolvedGitAuthorDisplay {
  const authorName = author.authorName.trim()
  const authorEmail = author.authorEmail.trim()
  const mappedPerson =
    lookup.byIdentity.get(identityKey(authorName, authorEmail)) ??
    (authorEmail ? lookup.byEmail.get(emailIdentityKey(authorEmail)) : undefined) ??
    lookup.byName.get(nameIdentityKey(authorName))

  return {
    authorDisplayName: mappedPerson?.displayName.trim() || authorName,
    authorDisplayEmail: authorEmail || firstPersonEmail(mappedPerson),
    mappedPersonId: mappedPerson?.id ?? ''
  }
}
