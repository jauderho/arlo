import React from 'react'
import userEvent from '@testing-library/user-event'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClientProvider } from 'react-query'
import Review from './Review'
import {
  settingsMock,
  sampleSizeMock,
  taskInProgressMock,
  taskCompleteMock,
} from './_mocks'
import {
  withMockFetch,
  renderWithRouter,
  createQueryClient,
} from '../../../testUtilities'
import { IJurisdiction } from '../../../useJurisdictions'
import { IContest } from '../../../../types'
import { IAuditSettings } from '../../../useAuditSettings'
import { ISampleSizesResponse } from './useSampleSizes'
import { FileProcessingStatus } from '../../../useCSV'
import { IContestNameStandardizations } from '../../../useContestNameStandardizations'
import {
  fileProcessingMocks,
  jurisdictionMocks,
  contestMocks,
  auditSettingsMocks,
  aaApiCalls,
} from '../../../_mocks'
import { ISamplePreview, ISampleSizes } from '../../useRoundsAuditAdmin'

const apiCalls = {
  getSettings: (response: IAuditSettings) => ({
    url: '/api/election/1/settings',
    response,
  }),
  getSampleSizeOptions: (response: ISampleSizesResponse) => ({
    url: '/api/election/1/sample-sizes/1',
    response,
  }),
  postComputeSamplePreview: (sampleSizes: ISampleSizes) => ({
    url: '/api/election/1/sample-preview',
    response: { status: 'ok' },
    options: {
      method: 'POST',
      body: JSON.stringify({ sampleSizes }),
      headers: { 'Content-Type': 'application/json' },
    },
  }),
  getSamplePreview: (response: ISamplePreview) => ({
    url: '/api/election/1/sample-preview',
    response,
  }),
  getRounds: {
    url: '/api/election/1/round',
    response: { rounds: [] },
  },
  getJurisdictions: (response: { jurisdictions: IJurisdiction[] }) => ({
    url: '/api/election/1/jurisdiction',
    response,
  }),
  getJurisdictionFile: {
    url: '/api/election/1/jurisdiction/file',
    response: {
      file: { name: 'jurisdictions.csv' },
      processing: fileProcessingMocks.processed,
    },
  },
  getStandardizedContestsFile: {
    url: '/api/election/1/standardized-contests/file',
    response: {
      file: { name: 'standardized-contests.csv' },
      processing: fileProcessingMocks.processed,
    },
  },
  getContests: (contests: IContest[]) => ({
    url: '/api/election/1/contest',
    response: { contests },
  }),
  getStandardizations: (response: IContestNameStandardizations) => ({
    url: '/api/election/1/contest/standardizations',
    response,
  }),
  putStandardizations: (
    standardizations: IContestNameStandardizations['standardizations']
  ) => ({
    url: '/api/election/1/contest/standardizations',
    response: { status: 'ok' },
    options: {
      body: JSON.stringify(standardizations),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    },
  }),
}

const renderView = (props = {}) => {
  const goToPrevStage = jest.fn()
  const startNextRound = jest.fn().mockResolvedValue(true)

  return {
    goToPrevStage,
    startNextRound,

    ...renderWithRouter(
      <QueryClientProvider client={createQueryClient()}>
        <Review
          electionId="1"
          startNextRound={startNextRound}
          locked={false}
          goToPrevStage={goToPrevStage}
          {...props}
        />
      </QueryClientProvider>
    ),
  }
}

const getLabeledText = (
  container: { getByText: typeof screen['getByText'] },
  label: string
) => {
  return container.getByText(label).nextSibling!
}

describe('Audit Setup > Review & Launch', () => {
  it('in a ballot polling audit, shows a setup summary and sample size options', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedAndOpportunistic),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Review & Launch' })

      const jurisdictionsSection = screen
        .getByRole('heading', { name: 'Participants' })
        .closest('section')!
      expect(
        getLabeledText(within(jurisdictionsSection), 'Jurisdictions')
      ).toHaveTextContent('3')
      expect(
        within(jurisdictionsSection).getByRole('link', {
          name: 'jurisdictions.csv',
        })
      ).toHaveAttribute('href', '/api/election/1/jurisdiction/file/csv')

      const contestsSection = screen
        .getByRole('heading', { name: 'Contests' })
        .closest('section')!
      const contest1 = within(contestsSection)
        .getByRole('heading', { name: 'Contest 1' })
        .closest('div.bp3-card') as HTMLElement

      // Contest settings
      within(contest1).getByText('Target Contest')
      within(contest1).getByText(
        '1 winner - 1 vote allowed - 30 total ballots cast'
      )

      const choices = within(contest1)
        .getByRole('columnheader', {
          name: 'Choice',
        })
        .closest('table')!
      within(choices).getByRole('columnheader', { name: 'Votes' })
      const choiceRows = within(choices).getAllByRole('row')
      within(choiceRows[1]).getByRole('cell', { name: 'Choice One' })
      within(choiceRows[1]).getByRole('cell', { name: '10' })
      within(choiceRows[2]).getByRole('cell', { name: 'Choice Two' })
      within(choiceRows[2]).getByRole('cell', { name: '20' })

      const universe = within(contest1)
        .getByRole('columnheader', {
          name: 'Contest universe: 2/3\xa0jurisdictions',
        })
        .closest('table')!
      const universeRows = within(universe).getAllByRole('row')
      expect(universeRows.length).toEqual(2 + 1) // Includes headers
      within(universeRows[1]).getByRole('cell', { name: 'Jurisdiction 1' })
      within(universeRows[2]).getByRole('cell', { name: 'Jurisdiction 2' })

      const contest2 = within(contestsSection)
        .getByRole('heading', { name: 'Contest 2' })
        .closest('div.bp3-card') as HTMLElement

      within(contest2).getByText('Opportunistic Contest')
      within(contest2).getByText(
        '2 winners - 2 votes allowed - 300,000 total ballots cast'
      )

      const settingsSection = screen
        .getByRole('heading', {
          name: 'Audit Settings',
        })
        .closest('section')!
      expect(
        getLabeledText(within(settingsSection), 'Election Name')
      ).toHaveTextContent('Test Election')
      expect(
        getLabeledText(within(settingsSection), 'Audit Type')
      ).toHaveTextContent('Ballot Polling')
      expect(
        getLabeledText(within(settingsSection), 'Risk Limit')
      ).toHaveTextContent('10%')
      expect(
        getLabeledText(within(settingsSection), 'Random Seed')
      ).toHaveTextContent('12345')
      expect(
        getLabeledText(within(settingsSection), 'Audit Board Data Entry')
      ).toHaveTextContent('Online')

      const sampleSizeSection = screen
        .getByRole('heading', {
          name: 'Sample Size',
        })
        .closest('section')!
      expect(
        within(sampleSizeSection).getByLabelText(
          '20 samples (BRAVO Average Sample Number - 54% chance of completing the audit in one round)'
        )
      ).toBeChecked()
      within(sampleSizeSection).getByLabelText(
        '21 samples (70% chance of completing the audit in one round)'
      )
      within(sampleSizeSection).getByLabelText(
        '22 samples (50% chance of completing the audit in one round)'
      )
      within(sampleSizeSection).getByLabelText(
        '31 samples (90% chance of completing the audit in one round)'
      )
      within(sampleSizeSection).getByLabelText(
        'Enter your own sample size (not recommended)'
      )

      expect(screen.getByRole('button', { name: 'Launch Audit' })).toBeEnabled()
      expect(
        screen.getByRole('button', { name: 'Preview Sample' })
      ).toBeEnabled()
    })
  })

  it('in a batch comparison audit, does not show sample size options when jurisdictions havent all uploaded batch tallies', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.batch),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Review & Launch' })
      const sampleSizeSection = screen
        .getByRole('heading', {
          name: 'Sample Size',
        })
        .closest('section')!
      within(sampleSizeSection).getByRole('link', {
        name: 'View jurisdiction file upload progress',
      })
      expect(
        within(sampleSizeSection).queryByRole('radio')
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Launch Audit' })
      ).toBeDisabled()
      expect(
        screen.getByRole('button', { name: 'Preview Sample' })
      ).toBeDisabled()
    })
  })

  it('in a batch comparison audit, shows sample size options once all tallies files uploaded', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.batch),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsAllTallies,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.batchComparison),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Review & Launch' })
      const sampleSizeSection = screen
        .getByRole('heading', {
          name: 'Sample Size',
        })
        .closest('section')!
      within(sampleSizeSection).getByLabelText('4 samples')
      within(sampleSizeSection).getByLabelText(
        'Enter your own sample size (not recommended)'
      )
      expect(screen.getByRole('button', { name: 'Launch Audit' })).toBeEnabled()
      expect(
        screen.getByRole('button', { name: 'Preview Sample' })
      ).toBeEnabled()
    })
  })

  it('for hybrid audits, shows the CVR/non-CVR vote totals and sample sizes, including a custom option', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.hybridAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsWithCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedAndOpportunistic),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
      apiCalls.getSampleSizeOptions({
        ...sampleSizeMock.ballotPolling,
        sampleSizes: {
          'contest-id': [
            { key: 'suite', size: 10, sizeCvr: 3, sizeNonCvr: 7, prob: null },
          ],
        },
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      const { startNextRound } = renderView()
      await screen.findByText('Review & Launch')

      // Vote totals in contest section
      const contest1 = screen
        .getAllByRole('heading', { name: 'Contest 1' })[0]
        .closest('div.bp3-card') as HTMLElement

      const choices = within(contest1)
        .getByRole('columnheader', {
          name: 'Choice',
        })
        .closest('table')!
      within(choices).getByRole('columnheader', { name: 'Votes' })
      within(choices).getByRole('columnheader', { name: 'CVR' })
      within(choices).getByRole('columnheader', { name: 'Non-CVR' })
      const choiceRows = within(choices).getAllByRole('row')
      within(choiceRows[1]).getByRole('cell', { name: 'Choice One' })
      within(choiceRows[1]).getByRole('cell', { name: '10' })
      within(choiceRows[1]).getByRole('cell', { name: '6' })
      within(choiceRows[1]).getByRole('cell', { name: '4' })
      within(choiceRows[2]).getByRole('cell', { name: 'Choice Two' })
      within(choiceRows[2]).getByRole('cell', { name: '20' })
      within(choiceRows[2]).getByRole('cell', { name: '12' })
      within(choiceRows[2]).getByRole('cell', { name: '8' })

      // Sample sizes
      const options = screen.getAllByRole('radio')
      expect(options).toHaveLength(2)
      expect(options[0].closest('label')).toHaveTextContent(
        '10 samples (3 CVR ballots and 7 non-CVR ballots)'
      )
      expect(options[1].closest('label')).toHaveTextContent(
        'Enter your own sample size (not recommended)'
      )

      // Enter a custom sample size
      userEvent.click(options[1])
      const cvrInput = screen.getByLabelText(/^CVR ballots:/)
      userEvent.type(cvrInput, '10')
      const nonCvrInput = screen.getByLabelText(/Non-CVR ballots:/)
      userEvent.type(nonCvrInput, '20')

      const launchButton = await screen.findByText('Launch Audit')
      userEvent.click(launchButton)
      await screen.findByText('Are you sure you want to launch the audit?')
      const confirmLaunchButton = screen.getAllByText('Launch Audit')[1]
      userEvent.click(confirmLaunchButton)

      await waitFor(() => {
        expect(startNextRound).toHaveBeenCalledWith({
          'contest-id': {
            key: 'custom',
            sizeCvr: 10,
            sizeNonCvr: 20,
            size: 30,
            prob: null,
          },
        })
      })
    })
  })

  it('for hybrid audits, doesnt show the CVR/non-CVR vote totals when sample sizes errors', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.hybridAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsWithCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
      apiCalls.getSampleSizeOptions({
        ...sampleSizeMock.ballotPolling,
        sampleSizes: null,
        task: {
          ...sampleSizeMock.ballotPolling.task,
          status: FileProcessingStatus.ERRORED,
          error: 'sample sizes error',
        },
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText('Review & Launch')

      const contest1 = screen
        .getAllByRole('heading', { name: 'Contest Name' })[0]
        .closest('div.bp3-card') as HTMLElement
      const choices = within(contest1)
        .getByRole('columnheader', {
          name: 'Choice',
        })
        .closest('table')!
      within(choices).getByRole('columnheader', { name: 'Votes' })
      within(choices).getByRole('columnheader', { name: 'CVR' })
      within(choices).getByRole('columnheader', { name: 'Non-CVR' })
      const choiceRows = within(choices).getAllByRole('row')
      expect(
        within(choiceRows[1])
          .getAllByRole('cell')
          .map(cell => cell.textContent)
      ).toEqual(['Choice One', '10', '', ''])

      // Check that the error from the sample size endpoint is shown
      screen.getByRole('heading', { name: 'Sample Size' })
      screen.getByText('sample sizes error')
    })
  })

  it('when CVRs arent all uploaded for ballot comparison audits, hides contest settings and sample sizes', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.ballotComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsSomeCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedAndOpportunistic),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText('Review & Launch')

      screen.getByRole('heading', { name: 'Contests' })
      const contest1 = screen
        .getAllByRole('heading', { name: 'Contest 1' })[0]
        .closest('div.bp3-card') as HTMLElement
      within(contest1).getByText(
        'Waiting for all jurisdictions to upload CVRs to compute contest settings.'
      )

      screen.getByRole('heading', { name: 'Sample Size' })
      screen.getByText(
        /All jurisdiction files must be uploaded and all audit settings must be configured in order to calculate the sample size./
      )
      expect(
        screen.getByRole('link', {
          name: 'View jurisdiction file upload progress',
        })
      ).toHaveAttribute('href', '/election/1/progress')
    })
  })

  it('launches the first round', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      const { startNextRound } = renderView()
      await screen.findByText('Review & Launch')
      const launchButton = screen.getByText('Launch Audit')
      userEvent.click(launchButton)
      await screen.findByText('Are you sure you want to launch the audit?')
      const confirmLaunchButton = screen.getAllByText('Launch Audit')[1]
      userEvent.click(confirmLaunchButton)
      await waitFor(() => {
        expect(startNextRound).toHaveBeenCalledWith({
          'contest-id': { key: 'asn', size: 20, prob: 0.54 },
        })
      })
    })
  })

  it('cancels audit launch', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText('Review & Launch')
      const launchButton = screen.getByText('Launch Audit')
      userEvent.click(launchButton)
      await screen.findByText('Are you sure you want to launch the audit?')
      const cancelLaunchButton = screen.getByText('Cancel')
      userEvent.click(cancelLaunchButton)
      await waitFor(() =>
        expect(
          screen.queryByText('Are you sure you want to launch the audit?')
        ).not.toBeInTheDocument()
      )
    })
  })

  it('launches the first round with a non-default sample size', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      const { startNextRound } = renderView()
      const newSampleSize = await screen.findByLabelText(
        '21 samples (70% chance of completing the audit in one round)'
      )
      userEvent.click(newSampleSize)
      const launchButton = await screen.findByText('Launch Audit')
      userEvent.click(launchButton)
      await screen.findByText('Are you sure you want to launch the audit?')
      const confirmLaunchButton = screen.getAllByText('Launch Audit')[1]
      userEvent.click(confirmLaunchButton)
      await waitFor(() => {
        expect(startNextRound).toHaveBeenCalledWith({
          'contest-id': { key: '0.7', size: 21, prob: 0.7 },
        })
      })
    })
  })

  it('accepts custom sample size', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      const { startNextRound } = renderView()
      const newSampleSize = await screen.findByText(
        'Enter your own sample size (not recommended)'
      )
      userEvent.click(newSampleSize)
      const customSampleSizeInput = await screen.findByRole('spinbutton')
      fireEvent.change(customSampleSizeInput, { target: { value: '40' } }) // userEvent has a problem with this field due to the lack of an explicit value field: https://github.com/testing-library/user-event/issues/356
      fireEvent.blur(customSampleSizeInput)
      await screen.findByText(
        'Must be less than or equal to 30 (the total number of ballots in the contest)'
      )
      userEvent.clear(customSampleSizeInput)
      fireEvent.change(customSampleSizeInput, { target: { value: '5' } })
      await waitFor(() =>
        expect(
          screen.queryByText(
            'Must be less than or equal to 30 (the total number of ballots in the contest)'
          )
        ).toBeNull()
      )
      const launchButton = await screen.findByText('Launch Audit')
      userEvent.click(launchButton)
      await screen.findByText('Are you sure you want to launch the audit?')
      const confirmLaunchButton = screen.getAllByText('Launch Audit')[1]
      userEvent.click(confirmLaunchButton)
      await waitFor(() => {
        expect(startNextRound).toHaveBeenCalledWith({
          'contest-id': { key: 'custom', size: 5, prob: null },
        })
      })
    })
  })

  it('has links to download jurisdictions and standardized contests file', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.ballotComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      const jurisdictionsFileLink = await screen.findByRole('link', {
        name: 'jurisdictions.csv',
      })
      expect(jurisdictionsFileLink).toHaveAttribute(
        'href',
        '/api/election/1/jurisdiction/file/csv'
      )
      const standardizedContestsFileLink = await screen.findByRole('link', {
        name: 'standardized-contests.csv',
      })
      expect(standardizedContestsFileLink).toHaveAttribute(
        'href',
        '/api/election/1/standardized-contests/file/csv'
      )
    })
  })

  it('custom sample size validation - batch comparison', async () => {
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.batch),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsAllTallies,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions(sampleSizeMock.batchComparison),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(
        'Choose the initial sample size for each contest you would like to use for Round 1 of the audit from the options below.'
      )
      const newSampleSize = await screen.findByText(
        'Enter your own sample size (not recommended)'
      )
      userEvent.click(newSampleSize)
      const customSampleSizeInput = await screen.findByRole('spinbutton')
      fireEvent.change(customSampleSizeInput, { target: { value: '40' } }) // userEvent has a problem with this field due to the lack of an explicit value field: https://github.com/testing-library/user-event/issues/356
      fireEvent.blur(customSampleSizeInput)
      await screen.findByText(
        'Must be less than or equal to 20 (the total number of batches in the contest)'
      )
    })
  })

  it('custom sample size validation - ballot comparison', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.ballotComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsWithCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotComparison),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(
        'Choose the initial sample size for each contest you would like to use for Round 1 of the audit from the options below.'
      )
      const newSampleSize = await screen.findByText(
        'Enter your own sample size (not recommended)'
      )
      userEvent.click(newSampleSize)
      const customSampleSizeInput = await screen.findByRole('spinbutton')
      fireEvent.change(customSampleSizeInput, { target: { value: '50' } }) // userEvent has a problem with this field due to the lack of an explicit value field: https://github.com/testing-library/user-event/issues/356
      fireEvent.blur(customSampleSizeInput)
      await screen.findByText(
        'Must be less than or equal to 30 (the total number of ballots in the contest)'
      )
    })
  })

  it('shows the selected sample size after launch', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.all),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      apiCalls.getSampleSizeOptions({
        ...sampleSizeMock.ballotPolling,
        selected: { 'contest-id': { key: 'custom', size: 100, prob: null } },
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView({ locked: true })
      await screen.findByText(/Choose the initial sample size/)
      // All the options should still be showing
      const options = screen.getAllByRole('radio')
      expect(options).toHaveLength(5)
      options.forEach(option => expect(option).toBeDisabled())
      expect(options[0].closest('label')).toHaveTextContent(
        '20 samples (BRAVO Average Sample Number - 54% chance of completing the audit in one round)'
      )
      expect(options[1].closest('label')).toHaveTextContent(
        '21 samples (70% chance of completing the audit in one round)'
      )
      expect(options[2].closest('label')).toHaveTextContent(
        '22 samples (50% chance of completing the audit in one round)'
      )
      expect(options[3].closest('label')).toHaveTextContent(
        '31 samples (90% chance of completing the audit in one round)'
      )
      expect(options[4].closest('label')).toHaveTextContent(
        'Enter your own sample size (not recommended)'
      )
      // Custom option should be checked and show value
      expect(options[4]).toBeChecked()
      const customSampleSizeInput = screen.getByRole('spinbutton')
      expect(customSampleSizeInput).toHaveValue(100)
      expect(customSampleSizeInput).toBeDisabled()
    })
  })

  it('shows warning and dialog to standardize contest names', async () => {
    const standardizations = {
      'jurisdiction-id-1': {
        'Contest 1': null,
      },
      'jurisdiction-id-2': {
        'Contest 2': null,
      },
    }
    const cvrContestNames = {
      'jurisdiction-id-1': ['Contest One', 'Contest Two'],
      'jurisdiction-id-2': ['Contest One', 'Contest Two'],
    }
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.ballotComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsWithCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedAndOpportunistic),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations,
        cvrContestNames,
      }),
      apiCalls.putStandardizations({
        'jurisdiction-id-1': {
          'Contest 1': 'Contest One',
        },
        'jurisdiction-id-2': {
          'Contest 2': null,
        },
      }),
      apiCalls.getStandardizations({
        standardizations: {
          ...standardizations,
          'jurisdiction-id-1': { 'Contest 1': 'Contest One' },
        },
        cvrContestNames,
      }),
      apiCalls.putStandardizations({
        'jurisdiction-id-1': {
          'Contest 1': 'Contest One',
        },
        'jurisdiction-id-2': {
          'Contest 2': 'Contest Two',
        },
      }),
      apiCalls.getStandardizations({
        standardizations: {
          'jurisdiction-id-1': { 'Contest 1': 'Contest One' },
          'jurisdiction-id-2': { 'Contest 2': 'Contest Two' },
        },
        cvrContestNames,
      }),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotComparison),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText('Review & Launch')

      // Sample size should not be fetched
      screen.getByRole('heading', { name: 'Sample Size' })
      screen.getByText(
        'All contest names must be standardized in order to calculate the sample size.'
      )
      expect(
        screen.getByRole('button', { name: 'Launch Audit' })
      ).toBeDisabled()

      // Open the dialog
      screen.getByText(
        'Some contest names in the CVR files do not match the target/opportunistic contest names.'
      )
      userEvent.click(
        screen.getByRole('button', { name: 'Standardize Contest Names' })
      )

      // Should show a form
      let dialog = (
        await screen.findByRole('heading', {
          name: 'Standardize Contest Names',
        })
      ).closest('div.bp3-dialog') as HTMLElement
      expect(
        within(dialog)
          .getAllByRole('columnheader')
          .map(header => header.textContent)
      ).toEqual(['Jurisdiction', 'Target/Opportunistic Contest', 'CVR Contest'])
      let rows = within(dialog).getAllByRole('row')
      within(rows[1]).getByRole('cell', { name: 'Jurisdiction 1' })
      within(rows[1]).getByRole('cell', { name: 'Contest 1' })
      within(rows[2]).getByRole('cell', { name: 'Jurisdiction 2' })
      within(rows[2]).getByRole('cell', { name: 'Contest 2' })

      // Select a CVR contest name
      const contest1Select = within(rows[1]).getByRole('combobox')
      expect(contest1Select).toHaveValue('')
      userEvent.selectOptions(contest1Select, 'Contest One')

      // Submit the form
      userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(dialog).not.toBeInTheDocument())

      // Should still show warning since we didn't finish standardizing
      screen.getByText(
        'Some contest names in the CVR files do not match the target/opportunistic contest names.'
      )

      // Reopen the form - should show the standardization we already did
      userEvent.click(
        screen.getByRole('button', { name: 'Standardize Contest Names' })
      )
      dialog = (
        await screen.findByRole('heading', {
          name: 'Standardize Contest Names',
        })
      ).closest('div.bp3-dialog') as HTMLElement
      rows = within(dialog).getAllByRole('row')
      expect(within(rows[1]).getByRole('combobox')).toHaveValue('Contest One')

      // Finish standardizing
      userEvent.selectOptions(
        within(rows[2]).getByRole('combobox'),
        'Contest Two'
      )
      userEvent.click(within(dialog).getByRole('button', { name: 'Submit' }))
      await waitFor(() => expect(dialog).not.toBeInTheDocument())

      // Warning is gone, sample sizes are shown
      screen.getByText(
        'All contest names in the CVR files have been standardized to match the target/opportunistic contest names.'
      )
      screen.getByText(
        'Choose the initial sample size for each contest you would like to use for Round 1 of the audit from the options below.'
      )

      // Can still open dialog to edit
      userEvent.click(
        screen.getByRole('button', { name: 'Edit Standardized Contest Names' })
      )
      dialog = (
        await screen.findByRole('heading', {
          name: 'Standardize Contest Names',
        })
      ).closest('div.bp3-dialog') as HTMLElement
      userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      await waitFor(() => expect(dialog).not.toBeInTheDocument())
    })
  })

  it('in ballot polling, shows a warning when selected sample size is a full hand tally', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.all),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(/Choose the initial sample size/)
      // Default option is not a full hand tally
      expect(
        screen.queryByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).not.toBeInTheDocument()

      // Select an option that requires a full hand tally
      userEvent.click(screen.getByLabelText(/90%/))
      const warning = (
        await screen.findByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).closest('.bp3-callout') as HTMLElement
      expect(warning).toHaveClass('bp3-intent-warning')
    })
  })

  it('in ballot polling, shows an error when one of multiple target contests is a full hand tally', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.all),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests([
        contestMocks.filledTargeted[0],
        {
          ...contestMocks.filledTargeted[0],
          name: 'Contest 2',
          id: 'contest-id-2',
        },
      ]),
      apiCalls.getSampleSizeOptions({
        ...sampleSizeMock.ballotPolling,
        sampleSizes: {
          ...sampleSizeMock.ballotPolling.sampleSizes,
          'contest-id-2': sampleSizeMock.ballotPolling.sampleSizes![
            'contest-id'
          ],
        },
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      const sampleSizeForm = (
        await screen.findByText(/Choose the initial sample size/)
      ).closest('form')!
      const contest1Card = within(sampleSizeForm)
        .getByRole('heading', { name: 'Contest Name' })
        .closest('div')!

      // Select an option that requires a full hand tally
      userEvent.click(within(contest1Card).getByLabelText(/90%/))
      const callout = (
        await within(contest1Card).findByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).closest('.bp3-callout') as HTMLElement
      within(callout).getByText(
        'Arlo supports running a full hand tally for audits with one target contest.' +
          ' Either remove this contest and audit it separately, or remove the other target contests.'
      )
      expect(callout).toHaveClass('bp3-intent-danger')
    })
  })

  it('shows a warning when custom sample size is a full hand tally', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.all),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(/Choose the initial sample size/)

      // Type a custom sample size that is a full hand tally
      userEvent.click(screen.getByLabelText(/Enter your own sample size/))
      userEvent.type(screen.getByRole('spinbutton'), '30')
      const warning = (
        await screen.findByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).closest('.bp3-callout') as HTMLElement
      expect(warning).toHaveClass('bp3-intent-warning')

      // Change to a smaller sample size
      userEvent.type(screen.getByRole('spinbutton'), '{backspace}{backspace}2')
      await waitFor(() =>
        expect(
          screen.queryByText(
            'The currently selected sample size for this contest requires a full hand tally.'
          )
        ).not.toBeInTheDocument()
      )
    })
  })

  it('in a ballot comparison audit, shows an error when sample size is a full hand tally', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.ballotComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsWithCVRs,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getStandardizedContestsFile,
      apiCalls.getStandardizations({
        standardizations: {},
        cvrContestNames: {},
      }),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotComparison),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(/Choose the initial sample size/)
      userEvent.click(screen.getByLabelText(/Enter your own sample size/))
      userEvent.type(screen.getByRole('spinbutton'), '30')
      const warning = (
        await screen.findByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).closest('.bp3-callout') as HTMLElement
      expect(warning).toHaveClass('bp3-intent-danger')
      within(warning).getByText(
        'To use Arlo for a full hand tally, recreate this audit using the ballot polling or batch comparison audit type.'
      )
    })
  })

  it('in a batch comparison audit, shows a warning when sample size is a full hand tally', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.batchComparisonAll),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifestsAllTallies,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByText(/Choose the initial sample size/)
      userEvent.click(screen.getByLabelText(/Enter your own sample size/))
      userEvent.type(screen.getByRole('spinbutton'), '20')
      const warning = (
        await screen.findByText(
          'The currently selected sample size for this contest requires a full hand tally.'
        )
      ).closest('.bp3-callout') as HTMLElement
      expect(warning).toHaveClass('bp3-intent-warning')
    })
  })

  it('has a button to show a sample preview', async () => {
    const expectedCalls = [
      apiCalls.getSettings(auditSettingsMocks.all),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargeted),
      apiCalls.getSampleSizeOptions(sampleSizeMock.ballotPolling),
      apiCalls.postComputeSamplePreview({
        'contest-id': sampleSizeMock.ballotPolling.sampleSizes![
          'contest-id'
        ][0],
      }),
      apiCalls.getSamplePreview({
        jurisdictions: null,
        task: taskInProgressMock,
      }),
      apiCalls.getSamplePreview({
        jurisdictions: jurisdictionMocks.noneStarted.map(j => ({
          name: j.name,
          numSamples: j.currentRoundStatus!.numSamples,
          numUnique: j.currentRoundStatus!.numUnique,
        })),
        task: taskCompleteMock,
      }),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Sample Size' })
      userEvent.click(screen.getByRole('button', { name: 'Preview Sample' }))

      const dialog = (
        await screen.findByRole('heading', { name: 'Sample Preview' })
      ).closest('div.bp3-dialog') as HTMLElement
      within(dialog).getByText('Drawing a random sample of ballots...')

      const previewTable = await within(dialog).findByRole('table')
      expect(
        within(previewTable)
          .getAllByRole('columnheader')
          .map(header => header.textContent)
      ).toEqual(['Jurisdiction', 'Samples', 'Unique Ballots'])
      expect(
        within(previewTable)
          .getAllByRole('row')
          .slice(1)
          .map(row =>
            within(row)
              .getAllByRole('cell')
              .map(cell => cell.textContent)
          )
      ).toEqual([
        ['Jurisdiction 1', '11', '10'],
        ['Jurisdiction 2', '22', '20'],
        ['Jurisdiction 3', '0', '0'],
        ['Total', '33', '30'],
      ])
    })
  })

  it('shows a spinner while sample sizes are computed', async () => {
    jest.useFakeTimers()
    const expectedCalls = [
      apiCalls.getSettings(settingsMock.full),
      apiCalls.getJurisdictions({
        jurisdictions: jurisdictionMocks.allManifests,
      }),
      apiCalls.getJurisdictionFile,
      apiCalls.getContests(contestMocks.filledTargetedWithJurisdictionId),
      aaApiCalls.getSampleSizes(sampleSizeMock.calculating),
      aaApiCalls.getSampleSizes(sampleSizeMock.ballotPolling),
    ]
    await withMockFetch(expectedCalls, async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Sample Size' })
      screen.getByText('Loading sample size options...')
      expect(
        screen.getByRole('button', { name: 'Preview Sample' })
      ).toBeDisabled()
      jest.advanceTimersByTime(1000)
      await screen.findByText(
        'Choose the initial sample size for each contest you would like to use for Round 1 of the audit from the options below.'
      )
    })
    jest.useRealTimers()
  })
})
