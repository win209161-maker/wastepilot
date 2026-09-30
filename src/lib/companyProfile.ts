export interface CompanyProfile {
  name: string
  phone: string
  address: string
  city: string
  logo_url: string
  invoice_footer: string
}

export function getCompanyProfile(orgId: string): Partial<CompanyProfile> {
  try {
    const raw = localStorage.getItem(`wp_company_profile_${orgId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveCompanyProfile(orgId: string, profile: Partial<CompanyProfile>) {
  localStorage.setItem(`wp_company_profile_${orgId}`, JSON.stringify(profile))
}

export function isProfileComplete(orgId: string): boolean {
  const p = getCompanyProfile(orgId)
  return !!(p.phone && p.city)
}

export function hasSkippedOnboarding(orgId: string): boolean {
  return localStorage.getItem(`wp_skip_onboarding_${orgId}`) === '1'
}

export function skipOnboarding(orgId: string) {
  localStorage.setItem(`wp_skip_onboarding_${orgId}`, '1')
}
