type ProjectSummary = {
  id: number;
  title: string;
  status: string;
};

let projects: ProjectSummary[] = [];

export const projectStore = {
  getState: () => projects,
  setProjects: (nextProjects: ProjectSummary[]) => {
    projects = nextProjects;
    return projects;
  },
};
