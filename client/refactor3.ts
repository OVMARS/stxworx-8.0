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

const sharedFile = project.createSourceFile('src/shared.tsx', `
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Bell, Globe, LayoutGrid, Users, BookOpen, Briefcase, Calendar, ShoppingBag, Newspaper,
  ChevronRight, Star, Plus, Heart, MessageSquare, Share2, MapPin, Link as LinkIcon, Twitter, Instagram,
  Facebook, MoreHorizontal, ArrowRight, Filter, CheckCircle2, Trophy, ChevronLeft, ChevronsRight, ChevronDown,
  Wallet, Send, X, Settings, ShieldCheck, LogOut, Mail, Phone, MessageCircle, Sun, Moon, Maximize2, Minimize2,
  HelpCircle, AlertTriangle, Folder, GraduationCap, Home, PenTool, Camera, Edit2, Share, Shield, Upload, FileText,
  Download, Sparkles, Bot, ZoomIn, ZoomOut
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
`, { overwrite: true });

const sharedNames = [
  'WalletContextType', 'WalletContext', 'useWallet',
  'StatProps', 'GroupProps', 'CourseProps', 'WorkProps',
  'Logo', 'StatCard', 'GroupCard', 'CourseCard', 'WorkCard',
  'MilestoneSubmitModal', 'ReviewWorkModal', 'MessageModal', 'PostJobModal', 'JobApplyModal',
  'CustomCursor', 'RequireWallet', 'ProtectedContent'
];

for (const name of sharedNames) {
  const typeAlias = appFile.getTypeAlias(name);
  if (typeAlias) {
    sharedFile.addTypeAlias({ ...typeAlias.getStructure(), isExported: true });
    typeAlias.remove();
    continue;
  }
  const interfaceDecl = appFile.getInterface(name);
  if (interfaceDecl) {
    sharedFile.addInterface({ ...interfaceDecl.getStructure(), isExported: true });
    interfaceDecl.remove();
    continue;
  }
  const varDecl = appFile.getVariableStatement(name);
  if (varDecl) {
    sharedFile.addVariableStatement({ ...varDecl.getStructure(), isExported: true });
    varDecl.remove();
    continue;
  }
}

const pageMap: Record<string, string> = {
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
  'ReviewProposalsPage': 'src/pages/ReviewProposalsPage.tsx',
  'ReviewWorkPage': 'src/pages/ReviewWorkPage.tsx',
  'MessagesPage': 'src/pages/MessagesPage.tsx',
  'NotificationsPage': 'src/pages/NotificationsPage.tsx',
  'AIProposalGenerator': 'src/components/proposals/AIProposalGenerator.tsx',
};

for (const [name, targetPath] of Object.entries(pageMap)) {
  const varDecl = appFile.getVariableStatement(name);
  if (varDecl) {
    let text = varDecl.getText();
    for (const sharedName of sharedNames) {
      const regex = new RegExp('\\b' + sharedName + '\\b', 'g');
      text = text.replace(regex, 'Shared.' + sharedName);
    }

    const isComponent = targetPath.includes('components/');
    const sharedImportPath = isComponent ? '../../shared' : '../shared';

    const targetFile = project.createSourceFile(targetPath, `
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Bell, Globe, LayoutGrid, Users, BookOpen, Briefcase, Calendar, ShoppingBag, Newspaper,
  ChevronRight, Star, Plus, Heart, MessageSquare, Share2, MapPin, Link as LinkIcon, Twitter, Instagram,
  Facebook, MoreHorizontal, ArrowRight, Filter, CheckCircle2, Trophy, ChevronLeft, ChevronsRight, ChevronDown,
  Wallet, Send, X, Settings, ShieldCheck, LogOut, Mail, Phone, MessageCircle, Sun, Moon, Maximize2, Minimize2,
  HelpCircle, AlertTriangle, Folder, GraduationCap, Home, PenTool, Camera, Edit2, Share, Shield, Upload, FileText,
  Download, Sparkles, Bot, ZoomIn, ZoomOut
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import * as Shared from '${sharedImportPath}';

export ${text}
`, { overwrite: true });

    varDecl.remove();
  }
}

appFile.addImportDeclaration({
  moduleSpecifier: './shared',
  namespaceImport: 'Shared'
});

for (const [name, targetPath] of Object.entries(pageMap)) {
  const importPath = targetPath.replace('src/', './').replace('.tsx', '');
  appFile.addImportDeclaration({
    moduleSpecifier: importPath,
    namedImports: [name]
  });
}

const appFunc = appFile.getFunction('App');
if (appFunc) {
  let text = appFunc.getText();
  for (const sharedName of sharedNames) {
    const regex = new RegExp('\\b' + sharedName + '\\b', 'g');
    text = text.replace(regex, 'Shared.' + sharedName);
  }
  appFunc.replaceWithText(text);
}

project.saveSync();
console.log('Refactoring complete');
