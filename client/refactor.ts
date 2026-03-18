import { Project, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const appFile = project.getSourceFile('src/App.tsx');
if (!appFile) {
  console.error('src/App.tsx not found');
  process.exit(1);
}

const structure = {
  pages: [
    'HomePage', 'ExploreJobsPage', 'ExploreFreelancersPage', 'LeaderboardPage',
    'JobDetailsPage', 'DashboardPage', 'PostJobPage', 'ProposalSubmitPage',
    'ContractPage', 'ProfilePage', 'SettingsPage', 'DisputePage', 'ProPlanPage',
    'DAOPage', 'AdminPage', 'BountyBoardPage', 'BountyDetailsPage', 'PostBountyPage',
    'ManageBountiesPage', 'MySubmissionsPage'
  ],
  'components/layout': ['Navbar', 'Sidebar', 'Footer', 'PageWrapper'],
  'components/wallet': ['WalletConnectButton', 'WalletBalanceDisplay', 'WalletGuard'],
  'components/jobs': ['JobCard', 'JobFilters', 'JobSort', 'MilestoneBuilder', 'DeadlineCountdown'],
  'components/proposals': ['ProposalCard', 'ProposalStatusBadge', 'ProposalList'],
  'components/contract': ['MilestoneTracker', 'MilestoneCard', 'EscrowFundButton', 'ApproveReleaseButton', 'SubmitWorkForm', 'DisputeButton', 'TransactionHistory'],
  'components/dispute': ['EvidenceUploader', 'DisputeTimeline', 'AdminResolutionPanel'],
  'components/freelancers': ['FreelancerCard', 'FreelancerFilters'],
  'components/profile': ['ProfileHeader', 'ReputationWidget', 'NFTBadgeCollection', 'CompletedJobsList', 'ReviewsList'],
  'components/leaderboard': ['LeaderboardTable', 'PodiumDisplay', 'RankHistoryChart'],
  'components/dashboard': ['StatsRow', 'ActiveContractCard', 'EarningsChart', 'NotificationFeed', 'EscrowOverview'],
  'components/bounty': ['BountyCard', 'BountyFilters', 'BountyTypeSelector', 'SubmissionList', 'PayoutPanel'],
  'components/nft': ['NFTBadge', 'NFTTooltip', 'VerifiedBadge'],
  'components/admin': ['AdminOverview', 'AdminUsers', 'AdminJobsQueue', 'AdminChats', 'AdminApprovals', 'AdminSupport', 'AdminNFTRelease'],
  'components/ui': ['Modal', 'Button', 'Input', 'Textarea', 'Select', 'Badge', 'Tabs', 'Tooltip', 'Spinner', 'Toast', 'ProgressBar'],
  'stores': ['useAppStore', 'useJobStore', 'useContractStore', 'useLeaderboardStore', 'useNotificationStore'],
  'lib': ['api', 'contracts', 'stacks', 'constants', 'utils'],
  'hooks': ['useWallet', 'useRole', 'useEscrow', 'useMilestone', 'useDispute', 'useLeaderboard'],
  'types': ['user', 'job', 'contract', 'bounty', 'nft', 'leaderboard']
};

// Create directories and files
for (const [dir, files] of Object.entries(structure)) {
  const dirPath = path.join('src', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  for (const file of files) {
    const isTs = dir === 'stores' || dir === 'lib' || dir === 'hooks' || dir === 'types';
    const ext = isTs ? '.ts' : '.tsx';
    const filePath = path.join(dirPath, `${file}${ext}`);
    if (!fs.existsSync(filePath)) {
      if (isTs) {
        fs.writeFileSync(filePath, `// ${file}\n`);
      } else {
        fs.writeFileSync(filePath, `import React from 'react';\n\nexport const ${file} = () => <div>${file}</div>;\n`);
      }
    }
  }
}

console.log('Structure created successfully');
