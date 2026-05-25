import { useEffect, useState } from 'react'
import { fetchJson } from '../utils/api'
import type { RegulationRuleGroup, RegulationVersionDetail } from '../utils/regulation'

interface RegulationVersionResponse {
  code?: string
  ruleGroups?: RegulationRuleGroup[]
}

function normalizeRegulationVersionDetail(
  detail: RegulationVersionResponse,
): RegulationVersionDetail {
  return {
    code: typeof detail.code === 'string' ? detail.code : '',
    ruleGroups: Array.isArray(detail.ruleGroups) ? detail.ruleGroups : [],
  }
}

export function useRegulationVersion(
  regulationVersionCode: string | null | undefined,
): {
  regulationVersion: RegulationVersionDetail | null
  isLoadingRegulationVersion: boolean
  regulationVersionError: string | null
} {
  const [regulationVersion, setRegulationVersion] = useState<RegulationVersionDetail | null>(null)
  const [isLoadingRegulationVersion, setIsLoadingRegulationVersion] = useState<boolean>(false)
  const [regulationVersionError, setRegulationVersionError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadRegulationVersion(): Promise<void> {
      if (!regulationVersionCode) {
        if (isActive) {
          setRegulationVersion(null)
          setRegulationVersionError(null)
          setIsLoadingRegulationVersion(false)
        }
        return
      }

      setIsLoadingRegulationVersion(true)
      setRegulationVersionError(null)
      try {
        const response = await fetchJson<RegulationVersionResponse>(
          `/api/regulation-versions/${encodeURIComponent(regulationVersionCode)}`,
        )
        if (!isActive) {
          return
        }
        setRegulationVersion(normalizeRegulationVersionDetail(response))
      } catch (error) {
        if (!isActive) {
          return
        }
        setRegulationVersion(null)
        setRegulationVersionError(
          error instanceof Error ? error.message : 'Failed to load the active regulation version.',
        )
      } finally {
        if (isActive) {
          setIsLoadingRegulationVersion(false)
        }
      }
    }

    void loadRegulationVersion()

    return () => {
      isActive = false
    }
  }, [regulationVersionCode])

  return { regulationVersion, isLoadingRegulationVersion, regulationVersionError }
}
