import React, { useState } from 'react'
import { useQuery } from 'react-query'
import { HTMLSelect, H3, Button } from '@blueprintjs/core'
import { IOrganization, useAuthDataContext, IAuditAdmin } from '../UserContext'
import { Wrapper, Inner } from '../Atoms/Wrapper'
import { StyledTable, downloadTableAsCSV } from '../Atoms/Table'
import { fetchApi } from '../../utils/api'

interface IActivity {
  id: string
  activityName: string
  timestamp: string
  user: {
    type: string
    key: string
    supportUser: boolean
  } | null
  election: {
    id: string
    auditName: string
    auditType: string
  } | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: any
}

const prettyAction = (activity: IActivity) => {
  switch (activity.activityName) {
    case 'CreateAudit':
      return `Created audit`
    case 'DeleteAudit':
      return `Deleted audit`
    case 'StartRound':
      return `Started round ${activity.info.round_num}`
    case 'EndRound':
      return `Ended round ${activity.info.round_num}`
    case 'CalculateSampleSizes':
      return `Calculated sample sizes`
    case 'UploadFile': {
      const fileType = ({
        ballot_manifest: 'ballot manifest',
        batch_tallies: 'candidate totals by batch',
        cvrs: 'CVRs',
      } as { [k: string]: string })[activity.info.file_type]
      return activity.info.error
        ? `Uploaded invalid ${fileType}`
        : `Successfully uploaded ${fileType}`
    }
    case 'CreateAuditBoards':
      return 'Created audit boards'
    case 'RecordResults':
      return 'Recorded results'
    case 'FinalizeBatchResults':
      return 'Finalized results'
    case 'AuditBoardSignOff':
      return `${activity.info.audit_board_name} signed off`
    case 'JurisdictionAdminLogin':
      if (activity.info.error)
        return (
          <span>
            Failed to log in as a Jurisdiction Manager: <br />
            {activity.info.error}
          </span>
        )
      return 'Logged in as a Jurisdiction Manager'
    default:
      throw Error(`Unknown activity: ${activity.activityName}`)
  }
}

const ActivityLog: React.FC = () => {
  const auth = useAuthDataContext()
  const user = auth && (auth.user as IAuditAdmin)
  const organizations = useQuery<IOrganization[]>(
    'orgs',
    () => fetchApi(`/api/audit_admins/${user!.id}/organizations`),
    { enabled: !!user }
  )
  if (!organizations.isSuccess) return null
  return <ActivityLogOrgsLoaded organizations={organizations.data} />
}

const ActivityLogOrgsLoaded = ({
  organizations,
}: {
  organizations: IOrganization[]
}) => {
  const [organization, setOrganization] = useState(organizations[0])
  const activities = useQuery(['orgs', organization.id, 'activities'], () =>
    fetchApi(`/api/organizations/${organization.id}/activities`)
  )

  if (!activities.isSuccess) return null

  const showOrgSelect = organizations.length > 1

  return (
    <Wrapper>
      <Inner>
        <div style={{ marginTop: '20px', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <H3 style={{ margin: 0 }}>Activity Log</H3>
            <div>
              {showOrgSelect && (
                // eslint-disable-next-line jsx-a11y/label-has-associated-control
                <label htmlFor="organizationId" style={{ marginRight: '10px' }}>
                  Organization:&nbsp;
                  <HTMLSelect
                    id="organizationId"
                    name="organizationId"
                    onChange={e =>
                      setOrganization(
                        organizations.find(
                          ({ id }) => id === e.currentTarget.value
                        )!
                      )
                    }
                    value={organization.id}
                    options={organizations.map(({ id, name }) => ({
                      label: name,
                      value: id,
                    }))}
                  />
                </label>
              )}
              <Button
                icon="download"
                onClick={() => {
                  downloadTableAsCSV({
                    tableId: 'activityLog',
                    fileName: `arlo-activity-${organization.name}.csv`,
                  })
                }}
              >
                Download as CSV
              </Button>
            </div>
          </div>
          <StyledTable id="activityLog" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Audit</th>
                <th>Jurisdiction</th>
              </tr>
            </thead>
            <tbody>
              {activities.data.map((activity: IActivity) => (
                <tr key={activity.id}>
                  <td>{new Date(activity.timestamp).toLocaleString()}</td>
                  <td>
                    {activity.user &&
                      activity.user.type !== 'audit_board' &&
                      (activity.user.supportUser || activity.user.key)}
                  </td>
                  <td>{prettyAction(activity)}</td>
                  <td>{activity.election && activity.election.auditName}</td>
                  <td>
                    {'jurisdiction_name' in activity.info &&
                      activity.info.jurisdiction_name}
                  </td>
                </tr>
              ))}
            </tbody>
          </StyledTable>
        </div>
      </Inner>
    </Wrapper>
  )
}

export default ActivityLog
