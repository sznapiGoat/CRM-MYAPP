import { Lead } from '@/types/lead'

// Lead scoring — 0–100, higher means a better cold-call target.
//
// The dominant signal is whether a website already exists. A redesign is a far
// easier sell than a site from scratch: the business has already decided it
// wants to be online and has paid for it once. An existing site that is clearly
// dated or broken is the best case of all — the pitch writes itself.
//
// Google rating is the secondary signal: a well-rated business has customers
// and money. Ratings at or below 2.5 add nothing, and a business with no rating
// at all is an unknown, so it scores as if it had none.
//
// The number of reviews weighs that rating: ★ 5,0 from two reviews says much
// less than ★ 4,6 from two hundred. Leads whose review count we never captured
// keep most of their rating points — we don't punish missing data.

const WEB_REDESIGN = 60   // has a site, and it is dated / bad → ideal
const WEB_EXISTS   = 50   // has a site, reason says nothing about its state
const WEB_NONE     = 20   // no site → build from scratch, hardest sell

const MAX_RATING_POINTS = 40
const RATING_FLOOR = 2.5
const RATING_MAX = 5

const REDESIGN_RE = /zastaral|špatn|spatn|starý web|stary web/i

export function hasWeb(lead: Pick<Lead, 'web'>): boolean {
  return !!lead.web && lead.web.trim() !== ''
}

export function webPoints(lead: Pick<Lead, 'web' | 'duvod'>): number {
  if (!hasWeb(lead)) return WEB_NONE
  return REDESIGN_RE.test(lead.duvod ?? '') ? WEB_REDESIGN : WEB_EXISTS
}

const REVIEWS_FOR_FULL_TRUST = 20
const UNKNOWN_REVIEWS_TRUST = 0.85
const MIN_REVIEWS_TRUST = 0.4

// How much of the rating we believe, given how many reviews produced it.
export function reviewsTrust(reviewsCount: number | null | undefined): number {
  if (reviewsCount == null) return UNKNOWN_REVIEWS_TRUST
  if (reviewsCount <= 0) return 0
  const ramp = MIN_REVIEWS_TRUST +
    (1 - MIN_REVIEWS_TRUST) * (reviewsCount / REVIEWS_FOR_FULL_TRUST)
  return Math.min(1, ramp)
}

export function ratingPoints(
  rating: number | null,
  reviewsCount?: number | null,
): number {
  if (rating == null) return 0
  const span = (rating - RATING_FLOOR) / (RATING_MAX - RATING_FLOOR)
  return Math.max(0, Math.min(1, span)) * MAX_RATING_POINTS * reviewsTrust(reviewsCount)
}

export function leadScore(
  lead: Pick<Lead, 'web' | 'duvod' | 'rating' | 'reviews_count'>,
): number {
  return Math.round(webPoints(lead) + ratingPoints(lead.rating, lead.reviews_count))
}

// Colour bands for the table cell — kept as full class strings so Tailwind
// picks them up.
export function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-lime-400'
  if (score >= 40) return 'text-amber-400'
  return 'text-zinc-500'
}
