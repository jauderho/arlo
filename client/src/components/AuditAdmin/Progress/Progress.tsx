/* eslint-disable react/prop-types */
import React, { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { Column, Cell, TableInstance, SortingRule } from 'react-table'
import { Button, Switch, ITagProps, Icon } from '@blueprintjs/core'
import H2Title from '../../Atoms/H2Title'
import {
  JurisdictionRoundStatus,
  IJurisdiction,
  getJurisdictionStatus,
  JurisdictionProgressStatus,
} from '../../useJurisdictions'
import JurisdictionDetail from './JurisdictionDetail'
import {
  Table,
  sortByRank,
  FilterInput,
  downloadTableAsCSV,
} from '../../Atoms/Table'
import { IRound } from '../useRoundsAuditAdmin'
import StatusTag from '../../Atoms/StatusTag'
import { IAuditSettings } from '../../useAuditSettings'
import { FileProcessingStatus, IFileInfo } from '../../useCSV'
import ProgressMap from './ProgressMap'
import { sum } from '../../../utils/number'
import { apiDownload, assert } from '../../utilities'
import AsyncButton from '../../Atoms/AsyncButton'
import useSearchParams from '../../useSearchParams'

const Wrapper = styled.div`
  flex-grow: 1;
  > p {
    margin-bottom: 25px;
  }
`

const TableControls = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  gap: 20px;
`

const formatNumber = ({ value }: { value: number | null }) =>
  value && value.toLocaleString()

// eslint-disable-next-line @typescript-eslint/ban-types
const totalFooter = <T extends object>(headerName: string) => (
  info: TableInstance<T>
) => sum(info.rows.map(row => row.values[headerName])).toLocaleString()

export interface IProgressProps {
  jurisdictions: IJurisdiction[]
  auditSettings: IAuditSettings
  round: IRound | null
}

const Progress: React.FC<IProgressProps> = ({
  jurisdictions,
  auditSettings,
  round,
}: IProgressProps) => {
  const { electionId } = useParams<{ electionId: string }>()
  // Store sort and filter state in URL search params to allow it to persist
  // across page refreshes
  const [sortAndFilterState, setSortAndFilterState] = useSearchParams<{
    sort?: string
    dir?: string // asc | desc
    filter?: string
  }>()
  const [isShowingUnique, setIsShowingUnique] = useState<boolean>(true)
  const [jurisdictionDetailId, setJurisdictionDetailId] = useState<
    string | null
  >(null)

  const { auditType } = auditSettings

  const ballotsOrBatches =
    auditType === 'BATCH_COMPARISON' ? 'Batches' : 'Ballots'

  const showDiscrepancies =
    round &&
    (auditType === 'BALLOT_COMPARISON' || auditType === 'BATCH_COMPARISON')
  const someJurisdictionHasDiscrepancies = jurisdictions.some(
    jurisdiction => (jurisdiction.currentRoundStatus?.numDiscrepancies || 0) > 0
  )

  const columns: Column<IJurisdiction>[] = [
    {
      Header: 'Jurisdiction',
      accessor: ({ name }) => name,
      // eslint-disable-next-line react/display-name
      Cell: ({ row: { original: jurisdiction } }: Cell<IJurisdiction>) => (
        <Button
          small
          intent="primary"
          minimal
          onClick={() => setJurisdictionDetailId(jurisdiction.id)}
        >
          {jurisdiction.name}
        </Button>
      ),
      Footer: 'Total',
    },
    {
      Header: 'Status',
      // eslint-disable-next-line react/display-name
      accessor: jurisdiction => {
        const { ballotManifest, batchTallies, cvrs } = jurisdiction

        const Status = (props: Omit<ITagProps, 'minimal'>) => (
          <StatusTag
            {...props}
            interactive
            onClick={() => setJurisdictionDetailId(jurisdiction.id)}
          />
        )

        const files: IFileInfo['processing'][] = [ballotManifest.processing]
        if (batchTallies) files.push(batchTallies.processing)
        if (cvrs) files.push(cvrs.processing)

        const numComplete = files.filter(
          f => f && f.status === FileProcessingStatus.PROCESSED
        ).length
        const filesUploadedText = `${numComplete}/${files.length} files uploaded`

        const jurisdictionStatus = getJurisdictionStatus(jurisdiction)
        switch (jurisdictionStatus) {
          case JurisdictionProgressStatus.UPLOADS_COMPLETE:
            return (
              <Status intent="success">
                {auditType === 'BALLOT_POLLING'
                  ? 'Manifest uploaded'
                  : filesUploadedText}
              </Status>
            )
          case JurisdictionProgressStatus.UPLOADS_FAILED:
            return (
              <Status intent="danger">
                {auditType === 'BALLOT_POLLING'
                  ? 'Manifest upload failed'
                  : 'Upload failed'}
              </Status>
            )
          case JurisdictionProgressStatus.UPLOADS_IN_PROGRESS:
            return <Status intent="warning">{filesUploadedText}</Status>
          case JurisdictionProgressStatus.UPLOADS_NOT_STARTED:
            return (
              <Status>
                {auditType === 'BALLOT_POLLING'
                  ? 'No manifest uploaded'
                  : filesUploadedText}
              </Status>
            )
          case JurisdictionProgressStatus.AUDIT_IN_PROGRESS:
            return <Status intent="warning">In progress</Status>
          case JurisdictionProgressStatus.AUDIT_COMPLETE:
            return <Status intent="success">Complete</Status>
          case JurisdictionProgressStatus.AUDIT_NOT_STARTED:
            return <Status>Not started</Status>
          default:
            return null
        }
      },
      sortType: sortByRank(
        ({ currentRoundStatus, ballotManifest, batchTallies, cvrs }) => {
          if (!currentRoundStatus) {
            const files: IFileInfo['processing'][] = [ballotManifest.processing]
            if (batchTallies) files.push(batchTallies.processing)
            if (cvrs) files.push(cvrs.processing)

            const numComplete = files.filter(
              f => f && f.status === FileProcessingStatus.PROCESSED
            ).length
            const anyFailed = files.some(
              f => f && f.status === FileProcessingStatus.ERRORED
            )
            if (anyFailed) return 0
            if (numComplete === 0) return -1
            return numComplete
          }
          return {
            [JurisdictionRoundStatus.NOT_STARTED]: 0,
            [JurisdictionRoundStatus.IN_PROGRESS]: 1,
            [JurisdictionRoundStatus.COMPLETE]: 2,
          }[currentRoundStatus.status]
        }
      ),
      Footer: info => {
        const numJurisdictionsComplete = sum(
          info.rows.map(row => {
            const {
              currentRoundStatus,
              ballotManifest,
              batchTallies,
              cvrs,
            } = row.original

            if (!currentRoundStatus) {
              const files: IFileInfo['processing'][] = [
                ballotManifest.processing,
              ]
              if (batchTallies) files.push(batchTallies.processing)
              if (cvrs) files.push(cvrs.processing)

              const numComplete = files.filter(
                f => f && f.status === FileProcessingStatus.PROCESSED
              ).length

              return numComplete === files.length ? 1 : 0
            }
            return currentRoundStatus.status ===
              JurisdictionRoundStatus.COMPLETE
              ? 1
              : 0
          })
        )
        return `${numJurisdictionsComplete.toLocaleString()}/${info.rows.length.toLocaleString()} complete`
      },
    },
    {
      Header: 'Ballots in Manifest',
      accessor: ({ ballotManifest: { numBallots } }) => numBallots,
      Cell: formatNumber,
      Footer: totalFooter('Ballots in Manifest'),
    },
  ]

  if (!round) {
    const hasExpectedNumBallots = jurisdictions.some(
      jurisdiction => jurisdiction.expectedBallotManifestNumBallots !== null
    )
    if (hasExpectedNumBallots) {
      columns.push({
        Header: 'Expected Ballots in Manifest',
        accessor: ({ expectedBallotManifestNumBallots }) =>
          expectedBallotManifestNumBallots,
        Cell: formatNumber,
        Footer: totalFooter('Expected Ballots in Manifest'),
      })
      columns.push({
        Header: 'Difference From Expected Ballots',
        accessor: ({
          ballotManifest: { numBallots },
          expectedBallotManifestNumBallots,
        }) =>
          numBallots !== null && expectedBallotManifestNumBallots !== null
            ? Math.abs(numBallots - expectedBallotManifestNumBallots)
            : null,
        Cell: formatNumber,
        Footer: totalFooter('Difference From Expected Ballots'),
      })
    }

    if (auditType === 'BATCH_COMPARISON') {
      columns.push({
        Header: 'Batches in Manifest',
        accessor: ({ ballotManifest: { numBatches } }) => numBatches,
        Cell: formatNumber,
        Footer: totalFooter('Batches in Manifest'),
      })
      columns.push({
        Header: 'Valid Voted Ballots in Batches',
        accessor: ({ batchTallies }) => batchTallies!.numBallots,
        Cell: formatNumber,
        Footer: totalFooter('Valid Voted Ballots in Batches'),
      })
    }

    if (auditType === 'HYBRID') {
      columns.push({
        Header: 'Non-CVR Ballots in Manifest',
        accessor: ({ ballotManifest: { numBallotsNonCvr } }) =>
          numBallotsNonCvr !== undefined ? numBallotsNonCvr : null,
        Cell: formatNumber,
        Footer: totalFooter('Non-CVR Ballots in Manifest'),
      })
      columns.push({
        Header: 'CVR Ballots in Manifest',
        accessor: ({ ballotManifest: { numBallotsCvr } }) =>
          numBallotsCvr !== undefined ? numBallotsCvr : null,
        Cell: formatNumber,
        Footer: totalFooter('CVR Ballots in Manifest'),
      })
    }

    if (auditType === 'BALLOT_COMPARISON' || auditType === 'HYBRID') {
      columns.push({
        Header: 'Ballots in CVR',
        accessor: ({ cvrs }) => cvrs!.numBallots,
        Cell: formatNumber,
        Footer: totalFooter('Ballots in CVR'),
      })
    }
  }

  if (round) {
    if (showDiscrepancies) {
      columns.push({
        Header: 'Discrepancies',
        accessor: ({ currentRoundStatus: s }) => s && s.numDiscrepancies,
        Cell: ({ value }: { value: number | null }) => {
          if (!value) return null
          return (
            <>
              <Icon icon="flag" intent="danger" /> {value.toLocaleString()}
            </>
          )
        },
        Footer: totalFooter('Discrepancies'),
      })
    }
    columns.push(
      {
        Header: `${ballotsOrBatches} Audited`,
        accessor: ({ currentRoundStatus: s }) =>
          s && (isShowingUnique ? s.numUniqueAudited : s.numSamplesAudited),
        Cell: formatNumber,
        Footer: totalFooter(`${ballotsOrBatches} Audited`),
      },
      {
        Header: `${ballotsOrBatches} Remaining`,
        accessor: ({ currentRoundStatus: s }) =>
          s &&
          (isShowingUnique
            ? s.numUnique - s.numUniqueAudited
            : s.numSamples - s.numSamplesAudited),
        Cell: formatNumber,
        Footer: totalFooter(`${ballotsOrBatches} Remaining`),
      }
    )
    // Special column for full hand tally
    if (
      jurisdictions[0].currentRoundStatus &&
      jurisdictions[0].currentRoundStatus.numBatchesAudited !== undefined
    ) {
      columns.push({
        Header: 'Batches Audited',
        accessor: ({ currentRoundStatus: s }) => s && s.numBatchesAudited!,
        Cell: formatNumber,
        Footer: totalFooter('Batches Audited'),
      })
    }
  }

  const filter = sortAndFilterState?.filter || ''
  const filteredJurisdictions = jurisdictions.filter(({ name }) =>
    name.toLowerCase().includes(filter.toLowerCase())
  )

  const initialSortBy = sortAndFilterState?.sort
    ? [
        {
          id: sortAndFilterState.sort,
          desc: sortAndFilterState.dir === 'desc',
        },
      ]
    : undefined
  const onSortByChange = useCallback(
    (newSortBy: SortingRule<unknown>[]) => {
      assert(newSortBy.length <= 1)
      const sortBy = newSortBy[0]
      setSortAndFilterState({
        ...sortAndFilterState,
        sort: sortBy?.id,
        dir: sortBy && (sortBy.desc ? 'desc' : 'asc'),
      })
    },
    [sortAndFilterState, setSortAndFilterState]
  )

  return (
    <Wrapper>
      <H2Title>Audit Progress</H2Title>
      {jurisdictions && auditSettings.state && (
        <ProgressMap
          stateAbbreviation={auditSettings.state}
          jurisdictions={jurisdictions}
          isRoundStarted={!!round}
          auditType={auditType}
        />
      )}
      <TableControls>
        <div style={{ flexGrow: 1 }}>
          <FilterInput
            placeholder="Filter by jurisdiction name..."
            value={filter}
            onChange={value =>
              setSortAndFilterState({
                ...sortAndFilterState,
                filter: value || undefined,
              })
            }
          />
        </div>
        {round && (
          <Switch
            checked={isShowingUnique}
            label={`Count unique sampled ${ballotsOrBatches.toLowerCase()}`}
            onChange={() => setIsShowingUnique(!isShowingUnique)}
            style={{ marginBottom: 0 }}
          />
        )}
        <div>
          <Button
            icon="download"
            onClick={() => {
              downloadTableAsCSV({
                tableId: 'progress-table',
                fileName: `audit-progress-${
                  auditSettings.auditName
                }-${new Date().toISOString()}.csv`,
              })
            }}
          >
            Download Table as CSV
          </Button>
          {showDiscrepancies && (
            <AsyncButton
              onClick={() =>
                apiDownload(`/election/${electionId}/discrepancy-report`)
              }
              icon={
                <Icon
                  icon="flag"
                  intent={someJurisdictionHasDiscrepancies ? 'danger' : 'none'}
                />
              }
              style={{ marginLeft: '5px' }}
            >
              Download Discrepancy Report
            </AsyncButton>
          )}
        </div>
      </TableControls>
      <Table
        data={filteredJurisdictions}
        columns={columns}
        id="progress-table"
        initialSortBy={initialSortBy}
        onSortByChange={onSortByChange}
      />
      {jurisdictionDetailId && (
        <JurisdictionDetail
          jurisdiction={
            jurisdictions.find(
              jurisdiction => jurisdiction.id === jurisdictionDetailId
            )!
          }
          electionId={electionId}
          round={round}
          handleClose={() => setJurisdictionDetailId(null)}
          auditSettings={auditSettings}
        />
      )}
    </Wrapper>
  )
}

export default Progress
