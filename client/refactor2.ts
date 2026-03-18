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

const componentMap: Record<string, string> = {
  'HomePage': 'src/pages/HomePage.tsx',
  'ExploreJobsPage': 'src/pages/ExploreJobsPage.tsx',
  'FreelancersPage': 'src/pages/ExploreFreelancersPage.tsx',
  'LeaderboardPage': 'src/pages/LeaderboardPage.tsx',
  'DashboardPage': 'src/pages/DashboardPage.tsx',
  'ProfilePage': 'src/pages/ProfilePage.tsx',
  'SettingsPage': 'src/pages/SettingsPage.tsx',
  'ProPlanPage': 'src/pages/ProPlanPage.tsx',
  'AdminDashboard': 'src/pages/AdminPage.tsx',
  'BountiesPage': 'src/pages/BountyBoardPage.tsx',
  'Sidebar': 'src/components/layout/Sidebar.tsx',
  'TopHeader': 'src/components/layout/Navbar.tsx',
  'RequireWallet': 'src/components/wallet/WalletGuard.tsx',
};

// Extraneous components to remove
const extraneous = [
  'CourseCard', 'GroupCard', 'PrivacyPolicyPage', 'TermsPage', 'ContactPage', 'PostPage', 'LiveChat'
];

// First, remove extraneous components
for (const name of extraneous) {
  const decl = appFile.getVariableStatement(name);
  if (decl) {
    decl.remove();
  }
}

// Now move mapped components
for (const [name, targetPath] of Object.entries(componentMap)) {
  const decl = appFile.getVariableStatement(name);
  if (decl) {
    const text = decl.getText();
    // write to target file
    const targetFile = project.getSourceFile(targetPath);
    if (targetFile) {
      // replace the stub
      const stub = targetFile.getVariableStatement(name);
      if (stub) stub.remove();
      
      // add imports
      targetFile.addImportDeclaration({
        moduleSpecifier: 'react',
        defaultImport: 'React',
        namedImports: ['useState', 'useEffect']
      });
      targetFile.addImportDeclaration({
        moduleSpecifier: 'react-router-dom',
        namedImports: ['Link', 'useNavigate', 'useLocation']
      });
      targetFile.addImportDeclaration({
        moduleSpecifier: 'motion/react',
        namedImports: ['motion', 'AnimatePresence']
      });
      targetFile.addImportDeclaration({
        moduleSpecifier: 'lucide-react',
        namedImports: ['Search', 'Bell', 'Globe', 'LayoutGrid', 'Users', 'BookOpen', 'Briefcase', 'Calendar', 'ShoppingBag', 'Newspaper', 'ChevronRight', 'Star', 'Plus', 'Heart', 'MessageSquare', 'Share2', 'MapPin', 'Link as LinkIcon', 'Twitter', 'Instagram', 'Facebook', 'MoreHorizontal', 'ArrowRight', 'Filter', 'CheckCircle2', 'Trophy', 'ChevronLeft', 'ChevronsRight', 'ChevronDown', 'Wallet', 'Send', 'X', 'Settings', 'ShieldCheck', 'LogOut', 'Mail', 'Phone', 'MessageCircle', 'Sun', 'Moon', 'Maximize2', 'Minimize2', 'HelpCircle', 'AlertTriangle', 'Folder', 'GraduationCap', 'Home', 'PenTool', 'Camera', 'Edit2', 'Share', 'Shield', 'Upload', 'FileText', 'Download', 'Sparkles', 'Bot', 'ZoomIn', 'ZoomOut']
      });
      
      // add the component
      targetFile.addStatements(`export ${text}`);
      
      // remove from App.tsx
      decl.remove();
      
      // add import to App.tsx
      const importPath = targetPath.replace('src/', './').replace('.tsx', '');
      appFile.addImportDeclaration({
        moduleSpecifier: importPath,
        namedImports: [name]
      });
    }
  }
}

project.saveSync();
console.log('Refactoring complete');
