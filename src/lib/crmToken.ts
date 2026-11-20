// Klíč, který Convex funkce vyžadují (viz convex/auth.ts). Do prohlížeče ho
// pošle server v layoutu, tedy až po přihlášení heslem; Providers ho nastaví
// dřív, než se vykreslí cokoli, co volá Convex.
let token = ''

export function setCrmToken(value: string) {
  token = value
}

export function crmToken(): string {
  return token
}
